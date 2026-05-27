import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useRouter } from 'expo-router';
import { useLanguage } from '../../languageContext';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// カレンダーの日本語設定
LocaleConfig.locales['jp'] = {
  monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  dayNames: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
  dayNamesShort: ['日', '月', '火', '水', '木', '金', '土'],
};
LocaleConfig.defaultLocale = 'jp';

// 本番用の広告IDとテスト用IDの切り替え設定
// iOS は AdMob で作成した V-HUB Banner の Ad Unit ID。Android は未取得なので暫定で iOS と同じ値。
const adUnitId = __DEV__
  ? TestIds.BANNER
  : (Platform.OS === 'ios'
      ? 'ca-app-pub-1117974208322223/6870237661'
      : 'ca-app-pub-1117974208322223/6870237661');

// 🌟 チーム名の変換辞書
const teamAbbreviations: { [key: string]: string } = {
  "ZETA DIVISION": "ZETA",
  "DetonatioN FocusMe": "DFM",
  "Paper Rex": "PRX",
  "Gen.G Esports": "GEN",
  "Talon Esports": "TLN",
  "Team Secret": "TS",
  "Rex Regum Qeon": "RRQ",
  "Global Esports": "GE",
  "Bleed Esports": "BLD",
  "Sentinels": "SEN",
  "LOUD": "LOUD",
  "NRG Esports": "NRG",
  "G2 Esports": "G2",
  "Fnatic": "FNC",
  "Natus Vincere": "NAVI",
  "Team Liquid": "TL",
  "Karmine Corp": "KC"
};

const formatTeamNames = (teamsString: string) => {
  if (!teamsString) return "";
  let formattedString = teamsString;
  Object.keys(teamAbbreviations).forEach(fullTeamName => {
    formattedString = formattedString.replace(new RegExp(fullTeamName, 'g'), teamAbbreviations[fullTeamName]);
  });
  return formattedString;
};

// JST(日本時間)の今日の日付(YYYY-MM-DD)を返す
const getJstToday = () => {
  const now = new Date();
  const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return jstNow.toISOString().split('T')[0];
};

export default function HomeScreen() {
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState("");
  const [activeTab, setActiveTab] = useState('ALL');
  // 🌟 今後/過去 切替
  const [timeMode, setTimeMode] = useState<'upcoming' | 'past'>('upcoming');
  const { t, locale, setLocale } = useLanguage();
  const router = useRouter();

  const toggleLanguage = () => {
    if (typeof setLocale === 'function') {
      setLocale(locale === 'ja' ? 'en' : 'ja');
    }
  };

  // 朝7時のサマリー通知(未来の試合のみ)
  const scheduleDailySummaryNotifications = async (eventsData: any[]) => {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const today = getJstToday();
    const matchesByDate: { [key: string]: any[] } = {};
    eventsData.forEach((event) => {
      if (!event.date) return;
      if (event.date < today) return; // 過去日は通知不要
      if (event.status === 'completed') return; // 終了済みも除外
      const dateKey = event.date;
      if (!matchesByDate[dateKey]) {
        matchesByDate[dateKey] = [];
      }
      matchesByDate[dateKey].push(event);
    });

    for (const [dateString, dailyMatches] of Object.entries(matchesByDate)) {
      const notificationTime = new Date(`${dateString}T07:00:00+09:00`);
      if (notificationTime < new Date()) continue;

      const firstMatchTeams = dailyMatches[0].teams || "試合";
      const extraCount = dailyMatches.length > 1 ? ` ほか${dailyMatches.length - 1}試合` : '';

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `☀️ 本日は ${dailyMatches.length} 試合予定されています!`,
          body: `${firstMatchTeams}${extraCount} が行われます。`,
          sound: 'default',
          badge: 1,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notificationTime
        },
      });
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await requestTrackingPermissionsAsync();
      try {
        const q = query(collection(db, "events"), orderBy("date", "asc"));
        const querySnapshot = await getDocs(q);
        const firebaseData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllEvents(firebaseData);
        await scheduleDailySummaryNotifications(firebaseData);
      } catch (error) {
        console.error("Firebaseからのデータ取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 🌟 カレンダーのドット: 今後=赤、過去=グレー
  const markedDates = useMemo(() => {
    const marks: any = {};
    const today = getJstToday();
    allEvents.forEach(event => {
      if (!event.date) return;
      const isPast = event.date < today || event.status === 'completed';
      const dotColor = isPast ? '#5A6470' : '#FF4655';
      marks[event.date] = { marked: true, dotColor };
    });
    if (selectedDate) {
      marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: '#FF4655' };
    }
    return marks;
  }, [allEvents, selectedDate]);

  // 🌟 フィルタリング: timeMode(upcoming/past) + category tab + selectedDate
  const filteredEvents = useMemo(() => {
    const today = getJstToday();

    const filtered = allEvents.filter(event => {
      if (!event.date) return false;

      // 日付で時系列フィルタ(selectedDateがあれば優先)
      let matchTimeline = true;
      if (selectedDate) {
        matchTimeline = event.date === selectedDate;
      } else if (timeMode === 'upcoming') {
        matchTimeline = event.date >= today && event.status !== 'completed';
      } else {
        matchTimeline = event.date < today || event.status === 'completed';
      }

      const matchType = activeTab === 'ALL' || event.type === activeTab;
      return matchTimeline && matchType;
    });

    // 過去モードは新しい順、今後モードは古い順
    if (!selectedDate && timeMode === 'past') {
      filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    return filtered;
  }, [allEvents, selectedDate, activeTab, timeMode]);

  const renderHeader = () => (
    <View style={{ backgroundColor: '#0F1923' }}>
      <View style={styles.topBar}>
        <Text style={styles.headerTitle}>
          {timeMode === 'upcoming'
            ? (t?.upcomingMatches || "Upcoming Matches")
            : (locale === 'ja' ? "過去の結果" : "Past Results")}
        </Text>
        <TouchableOpacity onPress={toggleLanguage} style={styles.langButton}>
          <Ionicons name="language" size={18} color="white" />
          <Text style={styles.langButtonText}>{locale === 'ja' ? 'EN' : 'JP'}</Text>
        </TouchableOpacity>
      </View>

      {/* 🌟 今後/過去 セグメント */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentButton, timeMode === 'upcoming' && styles.segmentActive]}
          onPress={() => { setTimeMode('upcoming'); setSelectedDate(""); }}
        >
          <Ionicons name="calendar-outline" size={14} color={timeMode === 'upcoming' ? '#FFFFFF' : '#8B97A2'} style={{ marginRight: 5 }} />
          <Text style={[styles.segmentText, timeMode === 'upcoming' && styles.segmentTextActive]}>
            {locale === 'ja' ? '今後の試合' : 'Upcoming'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentButton, timeMode === 'past' && styles.segmentActive]}
          onPress={() => { setTimeMode('past'); setSelectedDate(""); }}
        >
          <Ionicons name="trophy-outline" size={14} color={timeMode === 'past' ? '#FFFFFF' : '#8B97A2'} style={{ marginRight: 5 }} />
          <Text style={[styles.segmentText, timeMode === 'past' && styles.segmentTextActive]}>
            {locale === 'ja' ? '過去の結果' : 'Past Results'}
          </Text>
        </TouchableOpacity>
      </View>

      <Calendar
        theme={{
          backgroundColor: '#0F1923',
          calendarBackground: '#0F1923',
          textSectionTitleColor: '#8B97A2',
          selectedDayBackgroundColor: '#FF4655',
          selectedDayTextColor: '#ffffff',
          todayTextColor: '#FF4655',
          dayTextColor: '#ECE8E1',
          textDisabledColor: '#383E44',
          monthTextColor: '#ECE8E1',
          arrowColor: '#FF4655',
        }}
        onDayPress={day => setSelectedDate(day.dateString)}
        markedDates={markedDates}
      />

      <View style={styles.tabContainer}>
        {['ALL', 'VCT', 'VCJ', 'GC'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.listSubTitle}>
          {selectedDate
            ? `${selectedDate} ${locale === 'ja' ? 'の試合' : 'Matches'}`
            : timeMode === 'upcoming'
              ? (locale === 'ja' ? "今後の全試合" : "All Upcoming Matches")
              : (locale === 'ja' ? "過去の全試合" : "All Past Matches")}
        </Text>
        {selectedDate ? (
          <TouchableOpacity onPress={() => setSelectedDate("")} style={styles.clearDateButton}>
            <Text style={styles.clearDateText}>{locale === 'ja' ? '全日程を表示 ✕' : 'Clear Date ✕'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  // 🌟 リスト各アイテム
  const renderItem = ({ item }: { item: any }) => {
    const isCompleted = item.status === 'completed';
    const t1 = typeof item.team1_score === 'number' ? item.team1_score : null;
    const t2 = typeof item.team2_score === 'number' ? item.team2_score : null;
    const hasScore = isCompleted && t1 !== null && t2 !== null;
    const team1Won = hasScore && t1! > t2!;
    const team2Won = hasScore && t2! > t1!;

    // チーム名を split してそれぞれ略称化
    const rawNames = (item.teams || '').split(' vs ');
    const team1Name = formatTeamNames(rawNames[0] || '');
    const team2Name = formatTeamNames(rawNames[1] || '');

    const renderLogo = (uri?: string) =>
      uri ? (
        <Image source={{ uri }} style={styles.teamLogoSmall} resizeMode="contain" />
      ) : (
        <View style={styles.teamLogoFallback}>
          <Text style={styles.teamLogoFallbackText}>?</Text>
        </View>
      );

    return (
      <TouchableOpacity
        style={[styles.eventCard, { borderLeftWidth: 4, borderLeftColor: item.regionColor || '#444' }]}
        onPress={() => router.push(`/${item.id}`)}
      >
        <View style={styles.eventInfo}>
          <View style={styles.cardHeader}>
            <Text style={[styles.regionTag, { color: item.regionColor || '#ccc' }]}>{item.region}</Text>
            <View style={styles.cardHeaderRight}>
              {isCompleted && <Text style={styles.finalTag}>FINAL</Text>}
              <Text style={styles.itemDate}>{item.date}</Text>
            </View>
          </View>
          <View style={styles.teamsRow}>
            <View style={styles.matchupRow}>
              {renderLogo(item.team1_logo)}
              <Text
                style={[styles.teamNameInCard, team1Won && styles.winnerTeamName, isCompleted && team2Won && styles.dimText]}
                numberOfLines={1}
              >
                {team1Name}
              </Text>
              <Text style={styles.vsInCard}>vs</Text>
              {renderLogo(item.team2_logo)}
              <Text
                style={[styles.teamNameInCard, team2Won && styles.winnerTeamName, isCompleted && team1Won && styles.dimText]}
                numberOfLines={1}
              >
                {team2Name}
              </Text>
            </View>
            {hasScore && (
              <Text style={styles.cardScore}>
                <Text style={team1Won ? styles.scoreWin : styles.scoreLose}>{t1}</Text>
                <Text style={styles.scoreDash}>-</Text>
                <Text style={team2Won ? styles.scoreWin : styles.scoreLose}>{t2}</Text>
              </Text>
            )}
          </View>
          <View style={styles.eventDetailRow}>
            <Text style={[styles.eventTime, isCompleted && styles.dimText]}>{item.time}</Text>
            <Text style={styles.eventTitle} numberOfLines={1}> | {item.title}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF4655" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {timeMode === 'past'
                ? (locale === 'ja' ? '過去の試合データがありません' : 'No past matches')
                : (t?.noMatches || "No matches found")}
            </Text>
          </View>
        }
      />

      <View style={{ alignItems: 'center', width: '100%', paddingVertical: 5 }}>
        <BannerAd
          unitId={adUnitId}
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
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 15, paddingTop: 10 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#ECE8E1', paddingLeft: 15, textTransform: 'uppercase' },
  langButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2933', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20 },
  langButtonText: { color: 'white', fontWeight: 'bold', marginLeft: 6, fontSize: 10 },
  segmentContainer: { flexDirection: 'row', marginHorizontal: 15, marginTop: 12, marginBottom: 4, backgroundColor: '#1F2933', borderRadius: 8, padding: 4 },
  segmentButton: { flex: 1, flexDirection: 'row', paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  segmentActive: { backgroundColor: '#FF4655' },
  segmentText: { color: '#8B97A2', fontWeight: 'bold', fontSize: 13 },
  segmentTextActive: { color: '#FFFFFF' },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 15, marginTop: 5, marginBottom: 10 },
  tab: { paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, borderRadius: 4, backgroundColor: '#1F2933' },
  activeTab: { backgroundColor: '#FF4655' },
  tabText: { color: '#8B97A2', fontWeight: 'bold', fontSize: 12 },
  activeTabText: { color: '#FFFFFF' },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, marginBottom: 10 },
  listSubTitle: { color: '#8B97A2', fontSize: 12, fontWeight: 'bold' },
  clearDateButton: { backgroundColor: '#FF4655', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 4 },
  clearDateText: { color: 'white', fontSize: 11, fontWeight: 'bold' },
  listContent: { paddingBottom: 20 },
  eventCard: { backgroundColor: '#1A1A1A', borderRadius: 8, padding: 15, marginBottom: 12, marginHorizontal: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  finalTag: { color: '#5A6470', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginRight: 8, backgroundColor: '#252525', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  regionTag: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' },
  itemDate: { color: '#666', fontSize: 10 },
  eventInfo: { flex: 1 },
  teamsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  matchupRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  teamLogoSmall: { width: 22, height: 22, marginRight: 5, backgroundColor: '#252525', borderRadius: 11 },
  teamLogoFallback: { width: 22, height: 22, marginRight: 5, backgroundColor: '#252525', borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  teamLogoFallbackText: { color: '#8B97A2', fontSize: 11, fontWeight: 'bold' },
  teamNameInCard: { fontSize: 14, fontWeight: 'bold', color: '#FFFFFF', maxWidth: 90 },
  vsInCard: { color: '#8B97A2', fontSize: 11, marginHorizontal: 8, fontWeight: 'bold' },
  winnerTeamName: { color: '#FF4655' },
  eventTeams: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF', flex: 1 },
  dimText: { color: '#8B97A2' },
  cardScore: { fontSize: 18, fontWeight: '900', marginLeft: 8 },
  scoreWin: { color: '#FF4655' },
  scoreLose: { color: '#8B97A2' },
  scoreDash: { color: '#8B97A2', marginHorizontal: 3 },
  eventDetailRow: { flexDirection: 'row', alignItems: 'center' },
  eventTime: { color: '#FF4655', fontWeight: 'bold', fontSize: 13 },
  eventTitle: { color: '#8B97A2', fontSize: 12, flex: 1, marginLeft: 5 },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#8B97A2', fontSize: 14 },
  adContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F1923',
    width: '100%',
    paddingBottom: Platform.OS === 'ios' ? 10 : 0,
  },
});
