import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { C, S, R, F, card } from '../theme';
import { Icon } from '../Icon';
import { HapticFeedback } from '../utils/haptics';

export const KYC_STORAGE_KEY = 'lumen_kyc_data';

export interface KYCData {
  status: 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
  docType: 'AADHAAR' | 'VOTER_ID' | 'DRIVING_LICENSE' | 'PASSPORT';
  docNumber: string;
  docImageUri?: string;
  selfieUri?: string;
  verifiedAt?: string;
}

export const IdentityVerificationScreen: React.FC<{
  navigation?: any;
  onBack?: () => void;
}> = ({ navigation, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [kyc, setKyc] = useState<KYCData>({
    status: 'UNVERIFIED',
    docType: 'AADHAAR',
    docNumber: '',
  });

  const [docNumberInput, setDocNumberInput] = useState('');
  const [docImage, setDocImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KYC_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as KYCData;
          setKyc(parsed);
          setDocNumberInput(parsed.docNumber || '');
          if (parsed.docImageUri) setDocImage(parsed.docImageUri);
          if (parsed.selfieUri) setSelfieImage(parsed.selfieUri);
        }
      } catch (e) {
        console.error('Failed to load KYC status', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleGoBack = () => {
    if (onBack) return onBack();
    if (navigation?.goBack) return navigation.goBack();
  };

  const handlePickImage = async (type: 'doc' | 'selfie') => {
    try {
      HapticFeedback.light();
    } catch (_) {}

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: type === 'selfie' ? [1, 1] : [4, 3],
      quality: 0.8,
    });

    if (!res.canceled && res.assets && res.assets.length > 0) {
      if (type === 'doc') {
        setDocImage(res.assets[0].uri);
      } else {
        setSelfieImage(res.assets[0].uri);
      }
    }
  };

  const handleSubmit = async () => {
    if (!docNumberInput.trim()) {
      Alert.alert('Required', 'Please enter your government ID number.');
      return;
    }
    if (!docImage) {
      Alert.alert('Required', 'Please upload a photo of your Government ID.');
      return;
    }

    setSubmitting(true);
    try {
      HapticFeedback.heavy();
    } catch (_) {}

    setTimeout(async () => {
      const updated: KYCData = {
        status: 'VERIFIED',
        docType: kyc.docType,
        docNumber: docNumberInput.trim(),
        docImageUri: docImage || undefined,
        selfieUri: selfieImage || undefined,
        verifiedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(KYC_STORAGE_KEY, JSON.stringify(updated));
      setKyc(updated);
      setSubmitting(false);

      Alert.alert(
        'Identity Verified! 🎖️',
        'Congratulations! You are now a Verified Citizen Reporter. Your complaints will receive Gold Priority in municipal triage.'
      );
    }, 1200);
  };

  const handleReset = async () => {
    Alert.alert('Reset Verification', 'Are you sure you want to remove your verification data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(KYC_STORAGE_KEY);
          setKyc({ status: 'UNVERIFIED', docType: 'AADHAAR', docNumber: '' });
          setDocNumberInput('');
          setDocImage(null);
          setSelfieImage(null);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centre]}>
        <ActivityIndicator size="large" color={C.brand} />
      </View>
    );
  }

  const isVerified = kyc.status === 'VERIFIED';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Icon name="arrow-left" size={20} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Citizen KYC Verification</Text>
          <Text style={styles.headerSubtitle}>Official Gold Reporter Status</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Badge Card */}
        <View style={[card, styles.statusCard, isVerified && styles.statusCardVerified]}>
          <View style={styles.statusIconCircle}>
            <Icon
              name={isVerified ? 'shield' : 'user'}
              size={26}
              color={isVerified ? '#B45309' : C.muted}
            />
          </View>
          <Text style={styles.statusTitle}>
            {isVerified ? 'Verified Citizen Reporter' : 'Unverified Profile'}
          </Text>
          <Text style={styles.statusSub}>
            {isVerified
              ? `Government ID (${kyc.docType}) verified · Gold Triage Active`
              : 'Verify your government identity to unlock high-priority report routing and fast-track municipal action.'}
          </Text>

          {isVerified && (
            <View style={styles.goldPill}>
              <Icon name="check-circle" size={14} color="#B45309" />
              <Text style={styles.goldPillText}>TOP PRIORITY ROUTING ACTIVE</Text>
            </View>
          )}
        </View>

        {isVerified ? (
          <View style={[card, styles.verifiedDetailsCard]}>
            <Text style={styles.sectionHeading}>Verification Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Document Type</Text>
              <Text style={styles.detailValue}>{kyc.docType.replace('_', ' ')}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Document Number</Text>
              <Text style={styles.detailValue}>
                {kyc.docNumber ? `•••• •••• ${kyc.docNumber.slice(-4)}` : 'Verified'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Verified Date</Text>
              <Text style={styles.detailValue}>
                {kyc.verifiedAt ? new Date(kyc.verifiedAt).toLocaleDateString() : 'Active'}
              </Text>
            </View>

            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Text style={styles.resetBtnText}>Update or Reset ID</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Benefits */}
            <View style={styles.benefitsBox}>
              <Text style={styles.benefitTitle}>Why get verified?</Text>
              <View style={styles.benefitItem}>
                <Icon name="check" size={15} color={C.ok} />
                <Text style={styles.benefitText}>
                  Your complaints jump to the top of the ward engineer queue.
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Icon name="check" size={15} color={C.ok} />
                <Text style={styles.benefitText}>
                  Eliminates spam verification delays on pothole & manhole reports.
                </Text>
              </View>
              <View style={styles.benefitItem}>
                <Icon name="check" size={15} color={C.ok} />
                <Text style={styles.benefitText}>
                  Encrypted locally with government standard privacy protection.
                </Text>
              </View>
            </View>

            {/* Document Selection */}
            <Text style={styles.sectionHeading}>1. Select Government ID</Text>
            <View style={styles.docTypeRow}>
              {[
                { type: 'AADHAAR', label: 'Aadhaar' },
                { type: 'VOTER_ID', label: 'Voter ID' },
                { type: 'DRIVING_LICENSE', label: "Driver's Lic." },
                { type: 'PASSPORT', label: 'Passport' },
              ].map((doc) => {
                const on = kyc.docType === doc.type;
                return (
                  <TouchableOpacity
                    key={doc.type}
                    style={[styles.docTypeBtn, on && styles.docTypeBtnActive]}
                    onPress={() => setKyc({ ...kyc, docType: doc.type as any })}
                  >
                    <Text style={[styles.docTypeText, on && styles.docTypeTextActive]}>
                      {doc.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Document Number Input */}
            <Text style={styles.sectionHeading}>2. Enter ID Number</Text>
            <TextInput
              style={styles.input}
              placeholder={`Enter ${kyc.docType.replace('_', ' ')} Number`}
              placeholderTextColor={C.muted}
              value={docNumberInput}
              onChangeText={setDocNumberInput}
              autoCapitalize="characters"
            />

            {/* Document Photo Upload */}
            <Text style={styles.sectionHeading}>3. Upload Photo of ID</Text>
            <TouchableOpacity
              style={styles.uploadCard}
              onPress={() => handlePickImage('doc')}
              activeOpacity={0.7}
            >
              {docImage ? (
                <Image source={{ uri: docImage }} style={styles.previewImage} />
              ) : (
                <View style={styles.uploadInner}>
                  <Icon name="camera" size={24} color={C.body} />
                  <Text style={styles.uploadText}>Tap to select or photograph ID</Text>
                  <Text style={styles.uploadSub}>Front side with name & photo clearly visible</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color={C.ink} />
              ) : (
                <>
                  <Icon name="shield" size={18} color={C.ink} />
                  <Text style={styles.submitBtnText}>Verify Identity Now</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  centre: { alignItems: 'center', justifyContent: 'center' },
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
  headerTitleWrap: { flex: 1 },
  headerTitle: { ...F.heading, fontSize: 18, color: C.ink },
  headerSubtitle: { ...F.caption, fontSize: 12, marginTop: 1 },
  content: { padding: S.lg, paddingBottom: 50 },

  statusCard: {
    padding: S.xl,
    alignItems: 'center',
    marginBottom: S.lg,
  },
  statusCardVerified: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  statusIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.raised,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.sm,
  },
  statusTitle: { ...F.heading, fontSize: 18, textAlign: 'center' },
  statusSub: {
    ...F.body,
    fontSize: 13,
    textAlign: 'center',
    color: C.body,
    marginTop: 4,
    lineHeight: 18,
  },
  goldPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FDE68A',
    paddingHorizontal: S.md,
    paddingVertical: 4,
    borderRadius: R.pill,
    marginTop: S.md,
  },
  goldPillText: { fontSize: 11, fontWeight: '800', color: '#92400E', letterSpacing: 0.5 },

  benefitsBox: {
    backgroundColor: C.surface,
    padding: S.lg,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: S.lg,
  },
  benefitTitle: { ...F.bodyStrong, fontSize: 14, marginBottom: S.sm },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: S.sm, marginBottom: 6 },
  benefitText: { ...F.caption, fontSize: 13, color: C.body, flex: 1 },

  sectionHeading: { ...F.heading, fontSize: 15, marginBottom: S.sm, marginTop: S.sm },
  docTypeRow: { flexDirection: 'row', gap: S.xs, marginBottom: S.md },
  docTypeBtn: {
    flex: 1,
    paddingVertical: S.md,
    borderRadius: R.md,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTypeBtnActive: { backgroundColor: C.brand, borderColor: C.brandDeep },
  docTypeText: { ...F.bodyStrong, fontSize: 12, color: C.muted },
  docTypeTextActive: { color: C.ink, fontWeight: '800' },

  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.md,
    paddingHorizontal: S.lg,
    paddingVertical: S.md,
    fontSize: 15,
    color: C.ink,
    marginBottom: S.lg,
  },
  uploadCard: {
    backgroundColor: C.surface,
    borderRadius: R.lg,
    borderWidth: 2,
    borderColor: C.line,
    borderStyle: 'dashed',
    padding: S.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: S.xl,
    minHeight: 140,
    overflow: 'hidden',
  },
  uploadInner: { alignItems: 'center', gap: 6 },
  uploadText: { ...F.bodyStrong, fontSize: 14, color: C.ink },
  uploadSub: { ...F.caption, fontSize: 12, color: C.muted, textAlign: 'center' },
  previewImage: { width: '100%', height: 160, borderRadius: R.md },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.brand,
    paddingVertical: S.lg,
    borderRadius: R.lg,
    gap: 8,
  },
  submitBtnText: { ...F.bodyStrong, fontSize: 16, color: C.ink, fontWeight: '800' },

  verifiedDetailsCard: { padding: S.lg },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: S.md,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  detailLabel: { ...F.caption, fontSize: 13 },
  detailValue: { ...F.bodyStrong, fontSize: 14 },
  resetBtn: {
    marginTop: S.lg,
    paddingVertical: S.md,
    alignItems: 'center',
    borderRadius: R.md,
    backgroundColor: C.raised,
  },
  resetBtnText: { ...F.caption, fontSize: 13, color: C.bad, fontWeight: '700' },
});
