import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { C, S, R, F, card } from '../theme';
import { Icon } from '../Icon';
import { SafeRouteMap } from '../components/SafeRouteMap';
import { CivicRouteOption } from '../types/route.types';
import { RouteService } from '../services/route.service';
import { HapticFeedback } from '../utils/haptics';

export const SafeRouteScreen: React.FC<{
  navigation?: any;
  onBack?: () => void;
}> = ({ navigation, onBack }) => {
  const [routes, setRoutes] = useState<CivicRouteOption[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route-well-lit');
  const [travelMode, setTravelMode] = useState<'WALKING' | 'TWO_WHEELER' | 'DRIVING'>('WALKING');
  const [loading, setLoading] = useState(false);

  const calculateRoutes = async () => {
    setLoading(true);
    try {
      const data = await RouteService.calculateSafeRoutes({
        origin: { latitude: 12.9716, longitude: 77.5946 },
        destination: { latitude: 12.9780, longitude: 77.6400 },
        preference: 'SAFEST_WELL_LIT',
        travelMode,
        avoidWaterloggedZones: true,
        avoidUnlitStreets: true,
      });
      setRoutes(data);
      if (data.length > 0) setSelectedRouteId(data[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    calculateRoutes();
  }, [travelMode]);

  const handleStartNav = (route: CivicRouteOption) => {
    try {
      HapticFeedback.heavy();
    } catch (_) {}

    Alert.alert(
      'Safe Navigation Active 🚀',
      `Guiding via "${route.title}".\n\nTurn-by-turn alerts active. Potholes, unlit sectors, and open drains along the corridor are automatically bypassed.`
    );
  };

  const handleGoBack = () => {
    if (onBack) return onBack();
    if (navigation?.goBack) return navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={handleGoBack}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-left" size={20} color={C.ink} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Hazard-Free Safe Routes</Text>
          <Text style={styles.headerSubtitle}>Bypasses reported potholes, dark alleys & open drains</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Origin / Destination Search Card */}
        <View style={[card, styles.searchCard]}>
          <View style={styles.locationRow}>
            <View style={styles.dotOrigin} />
            <Text style={styles.locationInputText}>Current Location (Indiranagar 8th Main)</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.locationRow}>
            <View style={styles.dotDest} />
            <Text style={styles.locationInputText}>Indiranagar Metro Station (HAL 2nd Stage)</Text>
          </View>

          {/* Travel Mode Pills */}
          <View style={styles.modesRow}>
            {[
              { id: 'WALKING', label: 'Walk', icon: 'walk' },
              { id: 'TWO_WHEELER', label: 'Two-Wheeler', icon: 'bicycle' },
              { id: 'DRIVING', label: 'Drive', icon: 'car' },
            ].map(m => {
              const active = travelMode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeBtn, active && styles.modeBtnActive]}
                  onPress={() => {
                    try {
                      HapticFeedback.light();
                    } catch (_) {}
                    setTravelMode(m.id as any);
                  }}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={m.icon as any}
                    size={15}
                    color={active ? C.ink : C.muted}
                  />
                  <Text style={[styles.modeText, active && styles.modeTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Routes Map Component */}
        {routes.length > 0 && (
          <SafeRouteMap
            routes={routes}
            selectedRouteId={selectedRouteId}
            onSelectRoute={id => setSelectedRouteId(id)}
            onStartNavigation={handleStartNav}
          />
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
  headerTitleWrap: { flex: 1 },
  headerTitle: { ...F.heading, fontSize: 18, color: C.ink },
  headerSubtitle: { ...F.caption, fontSize: 12, marginTop: 1 },
  scroll: { flex: 1 },
  content: {
    padding: S.lg,
    paddingBottom: S.xxxl + 20,
  },
  searchCard: {
    padding: S.lg,
    marginBottom: S.lg,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  dotOrigin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.brand,
  },
  dotDest: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: C.ok,
  },
  locationInputText: {
    ...F.bodyStrong,
    fontSize: 13,
    color: C.ink,
  },
  divider: {
    height: 1,
    backgroundColor: C.line,
    marginVertical: 6,
  },
  modesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: S.md,
    paddingTop: S.md,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: C.raised,
    paddingVertical: S.md,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.line,
  },
  modeBtnActive: {
    backgroundColor: C.brand,
    borderColor: C.brandDeep,
  },
  modeText: {
    ...F.bodyStrong,
    fontSize: 12,
    color: C.muted,
  },
  modeTextActive: {
    color: C.ink,
    fontWeight: '800',
  },
});
