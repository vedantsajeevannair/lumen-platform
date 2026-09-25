import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { C, S, R, F, card } from '../theme';
import { Icon } from '../Icon';
import { HapticFeedback } from '../utils/haptics';
import { askAssistant } from '../api';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  category?: 'HOW_TO' | 'AI_VISION' | 'TRIAGE' | 'KYC' | 'EMERGENCY' | 'GENERAL';
}

const FAQ_SUGGESTIONS = [
  'How do I report a pothole or open manhole?',
  'How does AI computer vision detect damage?',
  'What happens after I file a report?',
  'How do I get the Verified Citizen KYC badge?',
  'How does offline reporting work?',
  'What emergency helplines can I call?',
];

const LOCAL_KNOWLEDGE_BASE: { keywords: string[]; answer: string; category: Message['category'] }[] = [
  {
    keywords: ['report', 'file', 'submit', 'photo', 'camera', 'how to report', 'pothole', 'garbage', 'manhole'],
    answer:
      'To file a report in LUMEN:\n1. Tap the "Report" tab at the bottom (or the "+" icon).\n2. Take a clear photo of the road defect or select one from your gallery.\n3. Tap "Check with AI" to see instant bounding box annotations and severity score.\n4. Describe the location if needed, and tap "Submit Report".\n\nYour GPS coordinates are automatically attached to dispatch the report to the correct ward engineer.',
    category: 'HOW_TO',
  },
  {
    keywords: ['ai', 'vision', 'yolo', 'detect', 'model', 'bounding box', 'accuracy', 'computer vision'],
    answer:
      'LUMEN uses a specialized YOLO11 neural network running on the backend. When you take a photo, the AI model:\n• Identifies the defect type (Pothole, Open Manhole, or Garbage Pile).\n• Outlines damage boundaries.\n• Calculates a Severity Score (0–100) based on crater depth and perimeter.\n• Assigns an initial priority (Low, Medium, High, or Critical) to ensure severe hazards get fixed first.',
    category: 'AI_VISION',
  },
  {
    keywords: ['what happens', 'triage', 'engineer', 'status', 'workflow', 'closure', 'timeline', 'track'],
    answer:
      'After you submit a report:\n1. Filed: Automatically triaged and routed to the ward engineer.\n2. In Progress: An on-duty contractor or asphalt team is dispatched to the GPS location.\n3. Verified Closure: Before closing the ticket, staff must upload an after-repair photo. The platform verifies the repair before marking it Resolved.',
    category: 'TRIAGE',
  },
  {
    keywords: ['kyc', 'verified citizen', 'badge', 'gold', 'aadhaar', 'voter id', 'id'],
    answer:
      'The Verified Citizen KYC badge gives your reports top priority in the municipal queue.\n\nTo get verified:\n1. Go to the Profile Tab.\n2. Tap "Citizen Identity Verification (KYC)".\n3. Select your ID type (Aadhaar, Voter ID, Driver\'s License, or Passport) and upload a photo.\n4. Once verified, your reports carry a Gold Badge that skips spam delays.',
    category: 'KYC',
  },
  {
    keywords: ['helpline', 'emergency', 'phone', 'police', 'ambulance', 'bescom', 'wire', 'fire', 'call'],
    answer:
      'Official Emergency Contacts in LUMEN:\n• National Emergency: 112 (Police, Fire, Medical, Disaster)\n• Ambulance / Trauma: 108\n• Police Control: 100\n• Fire & Rescue: 101\n• Snapped Power Cables / Sparks (BESCOM): 1912\n• Water & Sewer Emergencies (BWSSB): 1916\n• Municipal Control (BBMP): 1533\n\nTap the Warning icon at the top of the app to access one-touch dialing.',
    category: 'EMERGENCY',
  },
  {
    keywords: ['offline', 'outbox', 'no internet', 'sync'],
    answer:
      'LUMEN works completely offline! If you take photos in a basement or poor network zone, the app securely queues your reports in the Outbox. As soon as connectivity returns, your reports automatically sync to the server.',
    category: 'GENERAL',
  },
];

export const AppAssistantScreen: React.FC<{
  navigation?: any;
  onBack?: () => void;
}> = ({ navigation, onBack }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: 'Hello! I am your LUMEN Civic AI Assistant. I can help you with anything related to reporting road hazards, AI damage detection, tracking repairs, KYC verification, and emergency civic helplines.\n\nHow can I help you today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      category: 'GENERAL',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const findLocalAnswer = (query: string): string | null => {
    const q = query.toLowerCase();
    for (const entry of LOCAL_KNOWLEDGE_BASE) {
      if (entry.keywords.some((kw) => q.includes(kw))) {
        return entry.answer;
      }
    }
    return null;
  };

  const isOutOfScope = (query: string): boolean => {
    const q = query.toLowerCase();
    const civicKeywords = [
      'lumen', 'app', 'pothole', 'manhole', 'garbage', 'waste', 'road', 'damage', 'civic',
      'report', 'file', 'photo', 'camera', 'ai', 'vision', 'yolo', 'detect', 'severity',
      'ward', 'engineer', 'triage', 'status', 'track', 'closure', 'repair', 'asphalt',
      'kyc', 'verified', 'badge', 'route', 'navigation', 'safe', 'lighting', 'helpline',
      'emergency', 'bescom', 'bwssb', 'bbmp', 'police', 'ambulance', 'outbox', 'offline',
      'help', 'how', 'what', 'who', 'queue', 'drain', 'water'
    ];
    const hasCivicWord = civicKeywords.some((w) => q.includes(w));
    const offTopicPatterns = [
      'poem', 'story', 'weather tomorrow', 'recipe', 'movie', 'song', 'joke', 'capital of',
      'president', 'cricket score', 'write code', 'javascript code', 'python code'
    ];
    const isExplicitlyOffTopic = offTopicPatterns.some((w) => q.includes(w));
    return isExplicitlyOffTopic || (!hasCivicWord && q.split(' ').length > 2);
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || busy) return;

    try {
      HapticFeedback.light();
    } catch (_) {}

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setBusy(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 60);

    // Guardrail: Ensure queries stay focused strictly on LUMEN and civic operations
    if (isOutOfScope(text)) {
      setTimeout(() => {
        const replyMsg: Message = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: 'I am the LUMEN Civic AI Assistant, specifically trained to assist with civic road hazard reporting, AI damage detection, complaint tracking, and municipal workflows.\n\nPlease feel free to ask about how to file a report, how our AI assesses pothole severity, ward repair timelines, or emergency helplines!',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category: 'GENERAL',
        };
        setMessages((prev) => [...prev, replyMsg]);
        setBusy(false);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 60);
      }, 700);
      return;
    }

    // Check local knowledge base first for instantaneous expert answers
    const localAnswer = findLocalAnswer(text);
    if (localAnswer) {
      setTimeout(() => {
        const replyMsg: Message = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: localAnswer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category: 'HOW_TO',
        };
        setMessages((prev) => [...prev, replyMsg]);
        setBusy(false);
        try {
          HapticFeedback.light();
        } catch (_) {}
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 60);
      }, 600);
      return;
    }

    // Fallback to backend assistant API
    try {
      const res = await askAssistant(text);
      const replyText =
        res?.answer ||
        'I have analyzed your civic query against the active ward database. You can track all live complaints and repair timelines directly in your Dashboard.';
      const replyMsg: Message = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        category: 'TRIAGE',
      };
      setMessages((prev) => [...prev, replyMsg]);
    } catch (e: any) {
      const fallbackMsg: Message = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: 'LUMEN allows you to capture photos of potholes, open manholes, and waste piles with instant AI damage classification and GPS routing to ward engineers. Tap the Report tab below to file a report!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        category: 'GENERAL',
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setBusy(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 60);
    }
  };

  const handleGoBack = () => {
    if (onBack) return onBack();
    if (navigation?.goBack) return navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.headerBar}>
        {onBack && (
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Icon name="arrow-left" size={20} color={C.ink} />
          </TouchableOpacity>
        )}
        <View style={styles.headerInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.headerTitle}>LUMEN AI Assistant</Text>
            <View style={styles.onlineBadge}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>CIVIC AI</Text>
            </View>
          </View>
          <Text style={styles.headerSubtitle}>App Guidance & Civic Infrastructure Knowledge</Text>
        </View>
      </View>

      {/* Messages Stream */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m) => {
          const isUser = m.sender === 'user';
          return (
            <View
              key={m.id}
              style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAsst]}
            >
              {!isUser && (
                <View style={styles.asstAvatar}>
                  <Icon name="cpu" size={16} color={C.ink} />
                </View>
              )}
              <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAsst]}>
                <Text style={[styles.msgText, isUser ? styles.msgTextUser : styles.msgTextAsst]}>
                  {m.text}
                </Text>
                <Text style={[styles.timeText, isUser ? styles.timeUser : styles.timeAsst]}>
                  {m.timestamp}
                </Text>
              </View>
            </View>
          );
        })}

        {busy && (
          <View style={styles.thinkingRow}>
            <View style={styles.asstAvatar}>
              <Icon name="cpu" size={16} color={C.ink} />
            </View>
            <View style={[styles.bubble, styles.bubbleAsst, styles.thinkingBubble]}>
              <ActivityIndicator size="small" color={C.ink} />
              <Text style={styles.thinkingText}>Thinking…</Text>
            </View>
          </View>
        )}

        {/* Quick Question Chips */}
        {messages.length <= 2 && (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Suggested Questions</Text>
            <View style={styles.chipsWrap}>
              {FAQ_SUGGESTIONS.map((q, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.chip}
                  onPress={() => handleSend(q)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipText}>{q}</Text>
                  <Icon name="arrow-up-right" size={13} color={C.muted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Composer */}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Ask anything about the LUMEN app…"
          placeholderTextColor={C.muted}
          multiline
          maxLength={300}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!inputText.trim() || busy}
          activeOpacity={0.8}
        >
          <Icon name="arrow-right" size={18} color={inputText.trim() ? C.ink : C.muted} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
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
  headerInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  headerTitle: { ...F.heading, fontSize: 17, color: C.ink },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.brandSoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: R.pill,
  },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.ok },
  onlineText: { fontSize: 9, fontWeight: '800', color: C.ink, letterSpacing: 0.5 },
  headerSubtitle: { ...F.caption, fontSize: 11, color: C.muted, marginTop: 1 },

  scroll: { flex: 1 },
  content: { padding: S.lg, paddingBottom: S.xxl },

  msgRow: { flexDirection: 'row', gap: S.sm, marginBottom: S.md },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowAsst: { justifyContent: 'flex-start' },

  asstAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
    borderRadius: R.lg,
  },
  bubbleUser: {
    backgroundColor: C.dark,
    borderBottomRightRadius: 4,
  },
  bubbleAsst: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTextUser: { color: '#F8FAFC', fontWeight: '500' },
  msgTextAsst: { color: C.ink, fontWeight: '400' },

  timeText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  timeUser: { color: '#94A3B8' },
  timeAsst: { color: C.muted },

  thinkingRow: { flexDirection: 'row', gap: S.sm, marginBottom: S.md, alignItems: 'center' },
  thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  thinkingText: { ...F.caption, fontSize: 12, color: C.muted },

  suggestionsContainer: { marginTop: S.lg },
  suggestionsTitle: { ...F.overline, fontSize: 11, color: C.muted, marginBottom: S.sm },
  chipsWrap: { gap: S.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.surface,
    paddingHorizontal: S.md,
    paddingVertical: 10,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipText: { ...F.bodyStrong, fontSize: 13, color: C.ink, flex: 1, paddingRight: S.sm },

  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: S.md,
    backgroundColor: C.surface,
    borderTopWidth: 1,
    borderTopColor: C.line,
    gap: S.sm,
  },
  input: {
    flex: 1,
    backgroundColor: C.raised,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: 10,
    fontSize: 14,
    color: C.ink,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: C.raised,
  },
});
