import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { C, S, R, F, card } from '../theme';
import { Icon } from '../Icon';
import { HapticFeedback } from '../utils/haptics';

interface HelplineItem {
  id: string;
  name: string;
  number: string;
  category: string;
  badgeColor: string;
  description: string;
  icon: string;
}

const HELPLINES: HelplineItem[] = [
  {
    id: '112',
    name: 'National Emergency',
    number: '112',
    category: 'All-in-One 24/7',
    badgeColor: '#EF4444',
    description: 'Unified emergency response for Police, Fire, Medical & Rescue.',
    icon: 'shield',
  },
  {
    id: '108',
    name: 'Ambulance & Medical',
    number: '108',
    category: 'Trauma & Medical',
    badgeColor: '#DC2626',
    description: 'Emergency medical dispatch, accident first aid, and critical hospital transit.',
    icon: 'activity',
  },
  {
    id: '100',
    name: 'Police Control Room',
    number: '100',
    category: 'Law & Order',
    badgeColor: '#2563EB',
    description: 'Immediate law enforcement, crime report, and local patrol dispatch.',
    icon: 'shield',
  },
  {
    id: '101',
    name: 'Fire & Rescue Services',
    number: '101',
    category: 'Disaster & Fire',
    badgeColor: '#EA580C',
    description: 'Fire outbreak containment, building evacuation, and gas leak emergency.',
    icon: 'alert-triangle',
  },
  {
    id: '1912',
    name: 'Power & Electric Hazards',
    number: '1912',
    category: 'Electricity / BESCOM',
    badgeColor: '#D97706',
    description: 'High-voltage wire snaps, transformer sparks, open junction boxes, and blackouts.',
    icon: 'zap',
  },
  {
    id: '1916',
    name: 'Water & Sewerage Board',
    number: '1916',
    category: 'Water / BWSSB',
    badgeColor: '#0891B2',
    description: 'Sewer overflowing, main pipe bursts, missing drain slabs, and contaminated tap water.',
    icon: 'droplet',
  },
  {
    id: '1533',
    name: 'City Municipal Corporation',
    number: '1533',
    category: 'BBMP / Civic Ops',
    badgeColor: '#059669',
    description: 'Road cave-ins, fallen trees blocking highways, dead animal clearance, and street floodings.',
    icon: 'tool',
  },
  {
    id: '1077',
    name: 'Disaster Management',
    number: '1077',
    category: 'Natural Disasters',
    badgeColor: '#7C3AED',
    description: 'Monsoon flooding, severe storm damage, building collapses, and landslide rescue.',
    icon: 'alert-circle',
  },
  {
    id: '1095',
    name: 'Traffic Police Helpline',
    number: '1095',
    category: 'Traffic & Transit',
    badgeColor: '#4F46E5',
    description: 'Severe road blockages, traffic signal failure, accident towing, and highway assistance.',
    icon: 'navigation',
  },
  {
    id: '1091',
    name: 'Women Safety Helpline',
    number: '1091',
    category: 'Women Protection',
    badgeColor: '#DB2777',
    description: '24/7 dedicated support, emergency distress response, and safety escorts.',
    icon: 'user',
  },
];

interface ImpactGuide {
  title: string;
  icon: string;
  accent: string;
  danger: string;
  solution: string;
  actionTag: string;
}

const CIVIC_GUIDES: ImpactGuide[] = [
  {
    title: 'Potholes & Broken Asphalt',
    icon: 'alert-triangle',
    accent: '#D97706',
    danger:
      'Potholes cause thousands of fatal two-wheeler skids, severe spinal compressions, rim cracks, and sudden rear-end collisions when drivers swerve abruptly.',
    solution:
      'Photographing a pothole with GPS sends exact coordinates directly to the asphalt repair team, expediting cold-mix patching before accidents occur.',
    actionTag: 'Prevents Fatal Road Accidents',
  },
  {
    title: 'Open Manholes & Missing Drain Covers',
    icon: 'alert-circle',
    accent: '#DC2626',
    danger:
      'Missing manhole covers and broken drain grates turn into invisible death traps during night hours and monsoon waterlogging, risking drowning and catastrophic pedestrian falls.',
    solution:
      'Instant citizen alerts trigger rapid-response barricading within hours, followed by heavy-duty reinforced composite slab replacement.',
    actionTag: 'Prevents Drowning & Severe Falls',
  },
  {
    title: 'Garbage Piles & Choked Storm Drains',
    icon: 'trash-2',
    accent: '#059669',
    danger:
      'Uncollected waste heaps breed disease vectors (dengue, cholera, malaria), attract aggressive stray animal packs, and block stormwater drainage systems causing flash urban floods.',
    solution:
      'Your geo-verified photo alerts the ward sanitary inspector and dispatches municipal compactor trucks directly for immediate clearance.',
    actionTag: 'Stops Vector Outbreaks & Urban Floods',
  },
];

export const EmergencySOSScreen: React.FC<{
  navigation?: any;
  onBack?: () => void;
}> = ({ navigation, onBack }) => {
  const [activeTab, setActiveTab] = useState<'helplines' | 'whyReport'>('helplines');

  const handleCall = (number: string, name: string) => {
    try {
      HapticFeedback.heavy();
    } catch (_) {}

    Alert.alert(
      `Call ${name}?`,
      `You are about to dial emergency number ${number}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Call ${number}`,
          style: 'default',
          onPress: () => {
            Linking.openURL(`tel:${number}`).catch(() => {
              Alert.alert('Unable to dial', `Could not open phone dialer for ${number}.`);
            });
          },
        },
      ]
    );
  };

  const handleGoBack = () => {
    if (onBack) return onBack();
    if (navigation?.goBack) return navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* Top Navigation Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={handleGoBack}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-left" size={20} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Helplines & Civic Impact</Text>
          <Text style={styles.headerSubtitle}>Official emergency contacts & reporting guide</Text>
        </View>
      </View>

      {/* Mode Switcher Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'helplines' && styles.tabBtnActive]}
          onPress={() => setActiveTab('helplines')}
          activeOpacity={0.7}
        >
          <Icon
            name="phone"
            size={16}
            color={activeTab === 'helplines' ? C.ink : C.muted}
          />
          <Text
            style={[styles.tabText, activeTab === 'helplines' && styles.tabTextActive]}
          >
            Emergency Helplines
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'whyReport' && styles.tabBtnActive]}
          onPress={() => setActiveTab('whyReport')}
          activeOpacity={0.7}
        >
          <Icon
            name="info"
            size={16}
            color={activeTab === 'whyReport' ? C.ink : C.muted}
          />
          <Text
            style={[styles.tabText, activeTab === 'whyReport' && styles.tabTextActive]}
          >
            Why Report Issues
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'helplines' ? (
          <>
            {/* National 112 Priority Banner */}
            <TouchableOpacity
              style={styles.priorityBanner}
              activeOpacity={0.88}
              onPress={() => handleCall('112', 'National Emergency 112')}
            >
              <View style={styles.priorityTop}>
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityBadgeText}>24/7 TOLL FREE</Text>
                </View>
                <View style={styles.priorityCallBtn}>
                  <Icon name="phone" size={16} color="#FFFFFF" />
                  <Text style={styles.priorityCallText}>Dial 112</Text>
                </View>
              </View>
              <Text style={styles.priorityTitle}>National Emergency Helpline</Text>
              <Text style={styles.priorityDesc}>
                Single unified emergency number across India for instant Police, Ambulance, Fire & Disaster response.
              </Text>
            </TouchableOpacity>

            <Text style={styles.sectionHeader}>Departmental & Civic Contacts</Text>
            <Text style={styles.sectionSub}>
              Tap any card to instantly connect with the responsible civic or utility department.
            </Text>

            {/* Helpline Cards */}
            <View style={styles.helplineList}>
              {HELPLINES.filter(h => h.id !== '112').map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={[card, styles.helplineCard]}
                  activeOpacity={0.7}
                  onPress={() => handleCall(item.number, item.name)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <View style={[styles.iconBox, { backgroundColor: `${item.badgeColor}15` }]}>
                        <Icon name={item.icon} size={18} color={item.badgeColor} />
                      </View>
                      <View style={styles.titleInfo}>
                        <Text style={styles.cardName}>{item.name}</Text>
                        <View style={[styles.categoryBadge, { backgroundColor: `${item.badgeColor}15` }]}>
                          <Text style={[styles.categoryText, { color: item.badgeColor }]}>
                            {item.category}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.dialPill}>
                      <Icon name="phone" size={13} color={C.ink} />
                      <Text style={styles.dialNumber}>{item.number}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardDesc}>{item.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            {/* Why Report Introduction Card */}
            <View style={styles.infoBanner}>
              <View style={styles.infoIconBox}>
                <Icon name="shield" size={24} color={C.ink} />
              </View>
              <Text style={styles.infoBannerTitle}>Every Report Protects Lives</Text>
              <Text style={styles.infoBannerDesc}>
                Municipal teams manage thousands of square kilometers. Your geo-tagged reports spotlight hidden dangers, holding authorities accountable and prioritizing urgent repairs.
              </Text>
            </View>

            <Text style={styles.sectionHeader}>Critical Hazards & Community Impact</Text>
            <Text style={styles.sectionSub}>
              Learn how reporting specific civic issues prevents disasters in your neighborhood.
            </Text>

            {/* Civic Guides Cards */}
            {CIVIC_GUIDES.map((guide, idx) => (
              <View key={idx} style={[card, styles.guideCard]}>
                <View style={styles.guideHeader}>
                  <View style={[styles.guideIconBox, { backgroundColor: `${guide.accent}15` }]}>
                    <Icon name={guide.icon} size={20} color={guide.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.guideTitle}>{guide.title}</Text>
                    <View style={[styles.tagBadge, { backgroundColor: `${guide.accent}15` }]}>
                      <Text style={[styles.tagText, { color: guide.accent }]}>{guide.actionTag}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.guideSection}>
                  <Text style={styles.guideSubTitle}>⚠️ The Danger</Text>
                  <Text style={styles.guideBody}>{guide.danger}</Text>
                </View>

                <View style={[styles.guideSection, styles.guideSolutionSection]}>
                  <Text style={[styles.guideSubTitle, { color: C.ok }]}>✅ How Your Report Solves It</Text>
                  <Text style={styles.guideBody}>{guide.solution}</Text>
                </View>
              </View>
            ))}

            {/* How LUMEN Solves It 3-Step Summary */}
            <View style={[card, styles.howItWorksCard]}>
              <Text style={styles.howTitle}>The LUMEN 3-Step Resolution</Text>
              
              <View style={styles.stepRow}>
                <View style={styles.stepNumBox}><Text style={styles.stepNum}>1</Text></View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepHead}>Snap a Clear Photo</Text>
                  <Text style={styles.stepDesc}>AI automatically classifies damage depth, type, and exact GPS coordinates.</Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepNumBox}><Text style={styles.stepNum}>2</Text></View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepHead}>Ward Engineer Assignment</Text>
                  <Text style={styles.stepDesc}>Triage algorithms route the issue directly to the on-duty road or sanitation inspector.</Text>
                </View>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepNumBox}><Text style={styles.stepNum}>3</Text></View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepHead}>Verified Transparent Closure</Text>
                  <Text style={styles.stepDesc}>Staff uploads repair photos and measurements before the complaint is officially closed.</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: S.lg,
    paddingTop: S.xl,
    paddingBottom: S.md,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    gap: S.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: R.md,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    ...F.heading,
    fontSize: 18,
    color: C.ink,
  },
  headerSubtitle: {
    ...F.caption,
    fontSize: 12,
    marginTop: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: S.lg,
    paddingVertical: S.sm,
    gap: S.sm,
    backgroundColor: C.bg,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: S.md,
    borderRadius: R.md,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: C.brand,
    borderColor: C.brandDeep,
  },
  tabText: {
    ...F.bodyStrong,
    fontSize: 13,
    color: C.muted,
  },
  tabTextActive: {
    color: C.ink,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: S.lg,
    paddingBottom: S.xxxl + 20,
  },
  priorityBanner: {
    backgroundColor: '#0F172A',
    borderRadius: R.lg,
    padding: S.lg,
    marginBottom: S.lg,
  },
  priorityTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: S.sm,
  },
  priorityBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: S.sm,
    paddingVertical: 3,
    borderRadius: R.pill,
  },
  priorityBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  priorityCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: S.md,
    paddingVertical: 6,
    borderRadius: R.pill,
    gap: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  priorityCallText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  priorityTitle: {
    ...F.heading,
    fontSize: 18,
    color: '#F8FAFC',
  },
  priorityDesc: {
    ...F.body,
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    lineHeight: 18,
  },
  sectionHeader: {
    ...F.heading,
    fontSize: 16,
    marginTop: S.sm,
    marginBottom: 2,
  },
  sectionSub: {
    ...F.caption,
    fontSize: 12,
    marginBottom: S.md,
  },
  helplineList: {
    gap: S.md,
  },
  helplineCard: {
    padding: S.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: S.sm,
    gap: S.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: S.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleInfo: {
    flex: 1,
  },
  cardName: {
    ...F.bodyStrong,
    fontSize: 15,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: R.sm,
    marginTop: 3,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  dialPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.brand,
    paddingHorizontal: S.md,
    paddingVertical: 6,
    borderRadius: R.pill,
    gap: 4,
  },
  dialNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: C.ink,
  },
  cardDesc: {
    ...F.body,
    fontSize: 13,
    color: C.body,
    lineHeight: 18,
  },
  infoBanner: {
    backgroundColor: C.brandSoft,
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: R.lg,
    padding: S.lg,
    marginBottom: S.lg,
    alignItems: 'center',
  },
  infoIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.sm,
  },
  infoBannerTitle: {
    ...F.heading,
    fontSize: 17,
    textAlign: 'center',
    color: C.ink,
  },
  infoBannerDesc: {
    ...F.body,
    fontSize: 13,
    textAlign: 'center',
    color: C.body,
    marginTop: 4,
    lineHeight: 18,
  },
  guideCard: {
    padding: S.lg,
    marginBottom: S.md,
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    marginBottom: S.md,
  },
  guideIconBox: {
    width: 44,
    height: 44,
    borderRadius: R.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTitle: {
    ...F.heading,
    fontSize: 16,
  },
  tagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: R.sm,
    marginTop: 3,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  guideSection: {
    marginTop: S.sm,
  },
  guideSolutionSection: {
    marginTop: S.md,
    paddingTop: S.sm,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  guideSubTitle: {
    ...F.bodyStrong,
    fontSize: 13,
    marginBottom: 2,
  },
  guideBody: {
    ...F.body,
    fontSize: 13,
    color: C.body,
    lineHeight: 19,
  },
  howItWorksCard: {
    padding: S.lg,
    marginTop: S.sm,
    backgroundColor: C.surface,
  },
  howTitle: {
    ...F.heading,
    fontSize: 16,
    marginBottom: S.md,
  },
  stepRow: {
    flexDirection: 'row',
    gap: S.md,
    marginBottom: S.md,
  },
  stepNumBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  stepContent: {
    flex: 1,
  },
  stepHead: {
    ...F.bodyStrong,
    fontSize: 14,
  },
  stepDesc: {
    ...F.caption,
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
});
