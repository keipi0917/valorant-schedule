import React, { useState, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import * as Notifications from 'expo-notifications';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
const adUnitId = __DEV__ ? TestIds.BANNER : (Platform.OS === 'ios' ? 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx' : 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx');

// 🌟 チーム名の変換辞書（よく出るチームを登録しておきます）
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
  // ※ ここにご自身のデータに登場するチーム名を必要に応じて足してください
};

// 🌟 チーム名を略称に置き換える関数
const formatTeamNames = (teamsString: string) => {
  if (!teamsString) return "";
  let formattedString = teamsString;
  
  // 辞書の中身と一致する部分があれば、略称に置き換える
  Object.keys(teamAbbreviations).forEach(fullTeamName => {
    formattedString = formattedString.replace(new RegExp(fullTeamName, 'g'), teamAbbreviations[fullTeamName]);
  });
  
  return formattedString;
};

export default function HomeScreen() {
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(""); 
  const [activeTab, setActiveTab] = useState('ALL');
  const { t, locale, setLocale } = useLanguage(); 
  const router = useRouter();

  // 言語切り替え関数
  const toggleLanguage = () => {
    if (typeof setLocale === 'function') {
      setLocale(locale === 'ja' ? 'en' : 'ja');
    }
  };

  // 🌟 朝7時のサマリー通知機能
  const scheduleDailySummaryNotifications = async (eventsData) => {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const matchesByDate: { [key: string]: any[] } = {};
    eventsData.forEach((event) => {
      if (!event.date) return;
      const dateKey = event.date; 
      if (!matchesByDate[dateKey]) {
        matchesByDate[dateKey] = [];
      }
      matchesByDate[dateKey].push(event);
    });

    for (const [dateString, dailyMatches] of Object.entries(matchesByDate)) {
      // JST（日本時間）で朝7時に設定
      const notificationTime = new Date(`${dateString}T07:00:00+09:00`);

      if (notificationTime < new Date()) continue;

      const firstMatchTeams = dailyMatches[0].teams || "試合";
      const extraCount = dailyMatches.length > 1 ? ` ほか${dailyMatches.length - 1}試合` : '';

      // 🌟 ここを修正しました！（Expoの正しいtriggerの書き方）
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `☀️ 本日は ${dailyMatches.length} 試合予定されています！`,
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

  // Firebaseからデータ取得 ＆ トラッキング許可 ＆ 通知予約
  useEffect(() => {
    const fetchData = async () => {
      // 🌟 トラッキング許可のポップアップ
      await requestTrackingPermissionsAsync();

      try {
        const q = query(collection(db, "events"), orderBy("date", "asc"));
        const querySnapshot = await getDocs(q);
        const firebaseData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        setAllEvents(firebaseData);

        // 🌟 取得したデータを使ってサマリー通知を予約
        await scheduleDailySummaryNotifications(firebaseData);

      } catch (error) {
        console.error("Firebaseからのデータ取得エラー:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // カレンダーのドット表示用データ作成
  const markedDates = useMemo(() => {
    const marks: any = {};
    allEvents.forEach(event => {
      if (event.date) marks[event.date] = { marked: true, dotColor: '#FF4655' };
    });
    if (selectedDate) marks[selectedDate] = { ...marks[selectedDate], selected: true, selectedColor: '#FF4655' };
    return marks;
  }, [allEvents, selectedDate]);

  // フィルタリングロジック（未来優先表示 ＆ タブ切り替え）
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const today = jstNow.toISOString().split('T')[0];

    return allEvents.filter(event => {
      const matchDate = selectedDate ? event.date === selectedDate : event.date >= today;
      const matchType = activeTab === 'ALL' || event.type === activeTab;
      return matchDate && matchType;
    });
  }, [allEvents, selectedDate, activeTab]);

  // リストのヘッダー部分（UI全体）
  const renderHeader = () => (
    <View style={{ backgroundColor: '#0F1923' }}>
      <View style={styles.topBar}>
        <Text style={styles.headerTitle}>{t?.upcomingMatches || "Upcoming Matches"}</Text>
        <TouchableOpacity onPress={toggleLanguage} style={styles.langButton}>
          <Ionicons name="language" size={18} color="white" />
          <Text style={styles.langButtonText}>{locale === 'ja' ? 'EN' : 'JP'}</Text>
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
          {selectedDate ? `${selectedDate} ${locale === 'ja' ? 'の試合' : 'Matches'}` : (locale === 'ja' ? "今後の全試合" : "All Future Matches")}
        </Text>
        {selectedDate ? (
          <TouchableOpacity onPress={() => setSelectedDate("")} style={styles.clearDateButton}>
            <Text style={styles.clearDateText}>{locale === 'ja' ? '全日程を表示 ✕' : 'Clear Date ✕'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  // リストの各アイテム（試合カード）
  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.eventCard, { borderLeftWidth: 4, borderLeftColor: item.regionColor || '#444' }]} 
      onPress={() => router.push(`/${item.id}`)}
    >
      <View style={styles.eventInfo}>
        <View style={styles.cardHeader}>
          <Text style={[styles.regionTag, { color: item.regionColor || '#ccc' }]}>{item.region}</Text>
          <Text style={styles.itemDate}>{item.date}</Text>
        </View>
        <Text style={styles.eventTeams}>{formatTeamNames(item.teams)}</Text>
        <View style={styles.eventDetailRow}>
          <Text style={styles.eventTime}>{item.time}</Text>
          <Text style={styles.eventTitle} numberOfLines={1}> | {item.title}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF4655" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 試合リスト */}
      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t?.noMatches || "No matches found"}</Text>
          </View>
        }
      />
      
      {/* ★ 画面下部に固定されるバナー広告 */}
      <View style={styles.adContainer}>
        <BannerAd
          unitId={adUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true, 
          }}
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
  tabContainer: { flexDirection: 'row', paddingHorizontal: 15, marginTop: 15, marginBottom: 10 },
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
  regionTag: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1, textTransform: 'uppercase' },
  itemDate: { color: '#666', fontSize: 10 },
  eventInfo: { flex: 1 },
  eventTeams: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
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