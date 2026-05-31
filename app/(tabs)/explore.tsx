import { Image } from 'expo-image';
import { Linking, StyleSheet, View } from 'react-native';

import { Collapsible } from '@/components/ui/collapsible';
import { ExternalLink } from '@/components/external-link';
import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

const PRIVACY_URL = 'https://keipi0917.github.io/valorant-schedule/privacy-policy.html';
const SUPPORT_URL = 'https://keipi0917.github.io/valorant-schedule/';
const CONTACT_MAIL = 'karino.keita.s2@dc.tohoku.ac.jp';

export default function ExploreScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#0F1923', dark: '#0F1923' }}
      headerImage={
        <IconSymbol
          size={260}
          color="#FF4655"
          name="info.circle"
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText
          type="title"
          style={{
            fontFamily: Fonts.rounded,
          }}>
          V-HUB について
        </ThemedText>
      </ThemedView>

      <ThemedText style={styles.lead}>
        V-HUB は esports タクティカル FPS の試合スケジュール・結果・スコアを
        まとめて閲覧できる非公式のファンメイドアプリです。
      </ThemedText>

      <Collapsible title="使い方">
        <ThemedText>
          ホーム画面では「今後の試合」と「過去の結果」をワンタップで切り替えて
          確認できます。試合カードをタップすると、対戦カード・開始時刻 (JST)・
          大会名・スコア・配信リンクが表示されます。
        </ThemedText>
        <ThemedText>
          カレンダー画面では月単位で試合のある日が一目でわかります。
          試合詳細画面の「カレンダーに追加」をタップすると、iPhone の
          標準カレンダーに予定として保存できます。
        </ThemedText>
      </Collapsible>

      <Collapsible title="データソース">
        <ThemedText>
          公開されている esports 大会情報を 1 日 2 回自動で取得し、
          すべての時刻を日本時間 (JST) に変換して表示しています。
        </ThemedText>
        <ThemedText>
          配信リンクをタップすると、各リーグの公式 YouTube /
          Twitch チャンネルへ遷移します。
        </ThemedText>
      </Collapsible>

      <Collapsible title="注意事項">
        <ThemedText>
          ・本アプリはタイトル運営元および各大会公式とは関係のない、
          非公式のファンメイドアプリです。
        </ThemedText>
        <ThemedText>
          ・試合スケジュールは予告なく変更される場合があります。
          最新情報は各大会の公式チャンネルをご確認ください。
        </ThemedText>
        <ThemedText>
          ・チーム名・大会名・ロゴ等の表示は、試合情報を識別する
          目的でのみ使用しています。
        </ThemedText>
      </Collapsible>

      <Collapsible title="プライバシーポリシー">
        <ThemedText>
          本アプリはユーザーアカウントを必要とせず、氏名・メールアドレスなど
          の個人情報は収集しません。広告配信のため Google AdMob を通じて
          広告識別子 (IDFA) を利用する場合があります。詳細は以下をご覧ください。
        </ThemedText>
        <ExternalLink href={PRIVACY_URL}>
          <ThemedText type="link">プライバシーポリシーを開く</ThemedText>
        </ExternalLink>
      </Collapsible>

      <Collapsible title="お問い合わせ">
        <ThemedText>
          ご意見・ご要望・不具合のご報告は以下までお願いいたします。
        </ThemedText>
        <ThemedText
          type="link"
          onPress={() => Linking.openURL(`mailto:${CONTACT_MAIL}`)}>
          {CONTACT_MAIL}
        </ThemedText>
        <ExternalLink href={SUPPORT_URL}>
          <ThemedText type="link">サポートサイトを開く</ThemedText>
        </ExternalLink>
      </Collapsible>

      <View style={styles.footer}>
        <ThemedText style={styles.footerText}>V-HUB v1.0</ThemedText>
        <ThemedText style={styles.footerText}>© 2026 Kei Karino</ThemedText>
      </View>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#FF4655',
    bottom: -60,
    right: -30,
    position: 'absolute',
    opacity: 0.6,
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  lead: {
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 22,
  },
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#444',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    opacity: 0.6,
  },
});
