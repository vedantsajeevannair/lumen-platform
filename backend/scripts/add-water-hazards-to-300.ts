import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import { calculatePriority } from "../src/lib/priority.js";

const db = new PrismaClient();
const ROOT = path.join(import.meta.dirname, "..");
const UPLOADS = path.join(ROOT, "uploads");
const AI = process.env.AI_SERVICE_URL ?? "http://localhost:8100";

const ZONES = ["North Zone", "South Zone", "East Zone", "West Zone", "Central Zone"];

const WATER_HAZARD_LOCATIONS = [
  { street: "Outer Ring Road (Silk Board Junction)", spot: "near the storm drain outlet", zone: "South Zone", lat: 12.9172, lng: 77.6228, type: "Waterlogging", title: "Heavy waterlogging & storm drain overflow on Silk Board Junction" },
  { street: "Bellandur EcoSpace Main Road", spot: "at the service road underpass", zone: "East Zone", lat: 12.9260, lng: 77.6762, type: "Waterlogging", title: "Urban flood & knee-deep water accumulation on service road" },
  { street: "100 Feet Road Indiranagar", spot: "near 12th Main junction", zone: "East Zone", lat: 12.9719, lng: 77.6412, type: "Pipe Leak", title: "High-pressure municipal water pipeline burst & surface leak" },
  { street: "Sampige Road Malleshwaram", spot: "outside the flower market", zone: "North Zone", lat: 13.0034, lng: 77.5711, type: "Open Manhole", title: "Open manhole — missing stormwater grate near bus stop" },
  { street: "Bannerghatta Road (Dairy Circle)", spot: "near Sagar Hospitals", zone: "South Zone", lat: 12.9345, lng: 77.5976, type: "Waterlogging", title: "Severe drainage backup & waterlogging blocking hospital approach" },
  { street: "Whitefield Main Road", spot: "opposite ITPL Gate 2", zone: "East Zone", lat: 12.9856, lng: 77.7312, type: "Pipe Leak", title: "Underground main drinking water pipe rupture causing road collapse" },
  { street: "Mysore Road (Nayandahalli Junction)", spot: "near the metro station pillar 142", zone: "West Zone", lat: 12.9482, lng: 77.5255, type: "Waterlogging", title: "Monsoon rainwater stagnation & submerged road section" },
  { street: "MG Road (Anil Kumble Circle)", spot: "near Metro exit gate 3", zone: "Central Zone", lat: 12.9756, lng: 77.6067, type: "Open Manhole", title: "Open manhole — uncovered drainage shaft on pedestrian crossing" },
  { street: "Kanakapura Road (Sarakki Signal)", spot: "near the temple junction", zone: "South Zone", lat: 12.9067, lng: 77.5768, type: "Waterlogging", title: "Clogged stormwater drain leading to heavy street flooding" },
  { street: "Tumkur Road (Peenya Industrial Area)", spot: "near 4th Phase entrance", zone: "North Zone", lat: 13.0289, lng: 77.5180, type: "Pipe Leak", title: "Industrial utility water pipe leak spreading across roadway" },
  { street: "Old Airport Road (HAL junction)", spot: "near Command Hospital", zone: "East Zone", lat: 12.9602, lng: 77.6534, type: "Open Manhole", title: "Open manhole — broken concrete cover near hospital entry" },
  { street: "Brigade Road", spot: "near Residency Road corner", zone: "Central Zone", lat: 12.9733, lng: 77.6080, type: "Closed Manhole", title: "Closed manhole — inspection cover seated on Brigade Road" },
  { street: "Koramangala 80 Feet Road", spot: "near 4th Block park", zone: "South Zone", lat: 12.9351, lng: 77.6244, type: "Waterlogging", title: "Street waterlogging & blocked culvert outside residential gate" },
  { street: "Rajajinagar 1st Block", spot: "near Navrang Theatre", zone: "West Zone", lat: 12.9988, lng: 77.5532, type: "Pipe Leak", title: "Subsurface water pipeline seepage creating asphalt softening" },
];

const GENERAL_COMPLAINT_TEMPLATES = [
  { cat: "ROADS", label: "Pothole", dept: "RDS", title: "Deep road crater & asphalt erosion on {street}", sev: 78 },
  { cat: "ROADS", label: "Alligator Crack", dept: "RDS", title: "Extensive alligator fatigue cracking on {street}", sev: 65 },
  { cat: "WASTE", label: "Garbage Pile", dept: "SAN", title: "Accumulated unsegregated municipal garbage on {street}", sev: 52 },
  { cat: "WASTE", label: "Overflowing Bin", dept: "SAN", title: "Overflowing commercial dumpster & litter spill on {street}", sev: 46 },
  { cat: "WATER", label: "Open Manhole", dept: "WTR", title: "Open manhole — hazardous uncovered drainage chamber on {street}", sev: 88 },
  { cat: "WATER", label: "Closed Manhole", dept: "WTR", title: "Closed manhole — cover in place on {street}", sev: 5 },
  { cat: "WATER", label: "Waterlogging", dept: "WTR", title: "Road waterlogging & monsoon runoff backup on {street}", sev: 74 },
  { cat: "WATER", label: "Pipe Leak", dept: "WTR", title: "BWSSB pressurized water pipe leak on {street}", sev: 68 },
];

async function main() {
  const currentCount = await db.complaint.count();
  console.log(`Current total complaints in database: ${currentCount}`);

  const targetCount = 300;
  const toAdd = targetCount - currentCount;

  if (toAdd <= 0) {
    console.log(`Already at or above target count (${currentCount} >= ${targetCount}).`);
    return;
  }

  console.log(`Adding ${toAdd} new complaints with Water Hazards to reach exactly ${targetCount}...`);

  const depts = await db.department.findMany();
  const deptMap = Object.fromEntries(depts.map(d => [d.code, d]));

  const engineers = await db.engineer.findMany();

  // Find max ref
  const allComplaints = await db.complaint.findMany({ select: { ref: true } });
  let maxSeq = 10494;
  for (const c of allComplaints) {
    const num = parseInt(c.ref.replace("CMP-", ""), 10);
    if (!isNaN(num) && num > maxSeq) maxSeq = num;
  }

  // Get available images in uploads to reuse
  const uploadFiles = readdirSync(UPLOADS).filter(f => f.startsWith("citizen-") && f.endsWith(".jpg"));
  if (uploadFiles.length === 0) {
    console.error("No citizen images found in uploads directory.");
    return;
  }

  let added = 0;
  for (let i = 0; i < toAdd; i++) {
    maxSeq++;
    const ref = `CMP-${maxSeq}`;

    let loc, template;
    if (i < WATER_HAZARD_LOCATIONS.length) {
      loc = WATER_HAZARD_LOCATIONS[i];
      template = {
        cat: "WATER",
        label: loc.type,
        dept: "WTR",
        title: loc.title,
        sev: loc.type === "Open Manhole" ? 90 : loc.type === "Closed Manhole" ? 5 : 75
      };
    } else {
      const t = GENERAL_COMPLAINT_TEMPLATES[i % GENERAL_COMPLAINT_TEMPLATES.length];
      const street = WATER_HAZARD_LOCATIONS[i % WATER_HAZARD_LOCATIONS.length].street;
      const zone = ZONES[i % ZONES.length];
      loc = {
        street,
        spot: "near landmark",
        zone,
        lat: 12.90 + Math.random() * 0.12,
        lng: 77.52 + Math.random() * 0.18,
        type: t.label,
        title: t.title.replace("{street}", street)
      };
      template = t;
    }

    const dept = deptMap[template.dept] || deptMap.WTR;
    const imgFile = uploadFiles[i % uploadFiles.length];
    const newCitizenImgName = `citizen-${randomUUID()}.jpg`;
    const newAnnotatedImgName = `annotated-${randomUUID()}.png`;

    copyFileSync(path.join(UPLOADS, imgFile), path.join(UPLOADS, newCitizenImgName));
    copyFileSync(path.join(UPLOADS, imgFile), path.join(UPLOADS, newAnnotatedImgName));

    const statusOptions = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];
    const status = statusOptions[i % statusOptions.length];

    const engineer = engineers.find(e => e.departmentId === dept.id) || engineers[0];

    const detections = JSON.stringify([{
      label: template.label,
      confidence: +(0.75 + Math.random() * 0.22).toFixed(3),
      box: [50.0, 100.0, 500.0, 480.0],
      area_ratio: 0.35,
      category: template.cat
    }]);

    const prio = calculatePriority({
      severityScore: template.sev,
      confidence: 0.88,
      categoryLabel: template.label,
      lat: loc.lat,
      lng: loc.lng,
      nearbyReports: Math.floor(Math.random() * 3),
      createdAt: new Date(Date.now() - (i + 1) * 3600 * 1000 * 6),
    });

    const complaint = await db.complaint.create({
      data: {
        ref,
        title: template.title,
        description: `Civic infrastructure report filed via citizen app at ${loc.street}. Auto-routed by AI vision model to ${dept.name}.`,
        category: template.label,
        civicCategory: template.cat,
        status: status as any,
        lat: loc.lat,
        lng: loc.lng,
        address: `${loc.street}, ${loc.zone}, Bengaluru`,
        zone: loc.zone,
        departmentId: dept.id,
        engineerId: status !== "SUBMITTED" ? engineer.id : null,
        slaHours: dept.slaTarget || 24,
        severityScore: template.sev,
        severityBand: template.sev > 70 ? "HIGH" : template.sev > 40 ? "MEDIUM" : "LOW",
        priority: prio.priority,
        priorityScore: prio.score,
        priorityFactors: JSON.stringify(prio.factors),
        aiConfidence: 0.88,
        aiPredicted: true,
        aiModelMode: "TRAINED",
        detections,
        createdAt: new Date(Date.now() - (i + 1) * 3600 * 1000 * 6),
        updatedAt: new Date(),
        images: {
          create: {
            kind: "CITIZEN",
            path: `/uploads/${newCitizenImgName}`,
            annotated: `/uploads/${newAnnotatedImgName}`,
            detections,
            severity: template.sev,
          }
        },
        events: {
          create: [
            {
              type: "SUBMITTED",
              actor: "CITIZEN",
              message: `Complaint registered via Citizen Mobile App. GPS coordinates validated at ${loc.street}.`,
              createdAt: new Date(Date.now() - (i + 1) * 3600 * 1000 * 6),
            },
            {
              type: "AI_DETECTION",
              actor: "SYSTEM",
              message: `AI Vision classified as ${template.label} with 88.0% confidence. Routed to ${dept.name}.`,
              createdAt: new Date(Date.now() - (i + 1) * 3600 * 1000 * 5.8),
            }
          ]
        }
      }
    });

    added++;
  }

  const finalCount = await db.complaint.count();
  console.log(`\n🎉 Successfully added ${added} complaints!`);
  console.log(`Total complaints in LUMEN database is now: ${finalCount}`);
}

main().finally(() => db.$disconnect());
