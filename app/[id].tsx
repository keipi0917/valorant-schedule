import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator, Image, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// 🌟 試合詳細画面
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams();
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "events", id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setItem(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching document:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  const openStream = () => {
    const url = item?.youtube;
    if (url) {
      Linking.openURL(url).catch((err) => {
        console.error("Failed to open URL:", err);
        alert("配信ページを開けませんでした。");
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF4655" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.container}>
        <Text style={{ color: 'white', textAlign: 'center', marginTop: 50 }}>Event not found</Text>
      </View>
    );
  }

  // 🌟 スコア/勝敗ロジック
  const isCompleted = item.status === 'completed';
  const team1Score = typeof item.team1_score === 'number' ? item.team1_score : null;
  const team2Score = typeof item.team2_score === 'number' ? item.team2_score : null;
  const hasScore = isCompleted && team1Score !== null && team2Score !== null;
  const team1Won = hasScore && team1Score! > team2Score!;
  const team2Won = hasScore && team2Score! > team1Score!;

  const teamNames = (item.teams || '').split(' vs ');
  const team1Name = teamNames[0] ?? '';
  const team2Name = teamNames[1] ?? '';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{item.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.matchCard}>
          {/* 🌟 試合状態バッジ */}
          {isCompleted && (
            <View style={styles.statusBadgeCompleted}>
              <Text style={styles.statusBadgeText}>FINAL</Text>
            </View>
          )}
          {item.status === 'live' && (
            <View style={styles.statusBadgeLive}>
              <View style={styles.liveDot} />
              <Text style={styles.statusBadgeText}>LIVE</Text>
            </View>
          )}

          <View style={styles.vsContainer}>
            <View style={styles.teamSection}>
              <View style={styles.logoContainer}>
                {item.team1_logo ? (
                  <Image source={{ uri: item.team1_logo }} style={styles.teamLogo} resizeMode="contain" />
                ) : (
                  <View style={styles.noLogo}><Text style={styles.noLogoText}>?</Text></View>
                )}
              </View>
              <Text style={[styles.teamName, team1Won && styles.winnerName]}>{team1Name}</Text>
              {team1Won && <Text style={styles.winnerTag}>WIN</Text>}
            </View>

            {/* 🌟 スコア or VS */}
            <View style={styles.scoreContainer}>
              {hasScore ? (
                <Text style={styles.scoreText}>
                  <Text style={team1Won ? styles.scoreWinner : styles.scoreLoser}>{team1Score}</Text>
                  <Text style={styles.scoreSeparator}> - </Text>
                  <Text style={team2Won ? styles.scoreWinner : styles.scoreLoser}>{team2Score}</Text>
                </Text>
              ) : (
                <Text style={styles.vsText}>VS</Text>
              )}
            </View>

            <View style={styles.teamSection}>
              <View style={styles.logoContainer}>
                {item.team2_logo ? (
                  <Image source={{ uri: item.team2_logo }} style={styles.teamLogo} resizeMode="contain" />
                ) : (
                  <View style={styles.noLogo}><Text style={styles.noLogoText}>?</Text></View>
                )}
              </View>
              <Text style={[styles.teamName, team2Won && styles.winnerName]}>{team2Name}</Text>
              {team2Won && <Text style={styles.winnerTag}>WIN</Text>}
            </View>
          </View>

          <View style={styles.infoSection}>
            <View style={[styles.regionBadge, { backgroundColor: item.regionColor || '#444' }]}>
              <Text style={styles.regionText}>{item.region || 'UNKNOWN'}</Text>
            </View>
            <Text style={styles.timeText}>{item.date} {item.time}</Text>
          </View>
        </View>

        {/* 🌟 配信ボタンは未終了の試合のみ */}
        {!isCompleted && item.type !== 'GC' && item.youtube ? (
          <TouchableOpacity style={styles.streamButton} onPress={openStream}>
            <Ionicons name="logo-youtube" size={24} color="white" style={{ marginRight: 10 }} />
            <Text style={styles.buttonText}>公式配信を視聴する</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.noStreamContainer}>
            <Text style={styles.noStreamText}>
              {isCompleted
                ? "この試合は終了しています"
                : item.type === 'GC'
                  ? "この大会の公式配信リンクはありません"
                  : "配信URLが設定されていません"}
            </Text>
          </View>
        )}

        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionTitle}>大会詳細</Text>
          <Text style={styles.descriptionBody}>{item.title}</Text>
          {!isCompleted && item.type !== 'GC' && (
            <Text style={styles.descriptionSub}>※配信は各リージョンの公式チャンネルへ遷移します。</Text>
          )}
        </View>
      </ScrollView>

      <View style={{ alignItems: 'center', width: '100%', paddingVertical: 5 }}>
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1923' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F1923' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2933',
  },
  backButton: { marginRight: 15 },
  headerTitle: { color: '#ECE8E1', fontSize: 18, fontWeight: 'bold', flex: 1 },
  scrollContent: { padding: 20 },
  matchCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 15,
    padding: 25,
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#333',
  },
  statusBadgeCompleted: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#3A3A3A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeLive: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FF4655',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'white', marginRight: 4 },
  statusBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 30,
  },
  teamSection: { alignItems: 'center', flex: 1 },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#252525',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  teamLogo: { width: 60, height: 60 },
  noLogo: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  noLogoText: { color: '#8B97A2', fontSize: 24, fontWeight: 'bold' },
  teamName: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', textAlign: 'center' },
  winnerName: { color: '#FF4655' },
  winnerTag: { color: '#FF4655', fontSize: 10, fontWeight: '900', marginTop: 3, letterSpacing: 1 },
  scoreContainer: { alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  vsText: { color: '#FF4655', fontSize: 24, fontWeight: '900', marginHorizontal: 10, fontStyle: 'italic' },
  scoreText: { fontSize: 32, fontWeight: '900' },
  scoreWinner: { color: '#FF4655' },
  scoreLoser: { color: '#8B97A2' },
  scoreSeparator: { color: '#8B97A2' },
  infoSection: { alignItems: 'center' },
  regionBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginBottom: 10,
  },
  regionText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  timeText: { color: '#ECE8E1', fontSize: 18, fontWeight: 'bold' },
  streamButton: {
    backgroundColor: '#FF4655',
    flexDirection: 'row',
    height: 60,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 25,
  },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  noStreamContainer: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 25,
  },
  noStreamText: {
    color: '#8B97A2',
    fontSize: 14,
    fontStyle: 'italic',
  },
  descriptionContainer: {
    padding: 20,
    backgroundColor: '#161F28',
    borderRadius: 8,
  },
  descriptionTitle: { color: '#8B97A2', fontSize: 12, fontWeight: 'bold', marginBottom: 5, textTransform: 'uppercase' },
  descriptionBody: { color: '#ECE8E1', fontSize: 16, lineHeight: 24 },
  descriptionSub: { color: '#666', fontSize: 11, marginTop: 10 },
});
