import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  locale: 'ja' | 'en';
  onContinue: () => void;
};

// ATT の iOS 標準ダイアログを出す前に表示する説明画面。
// 選択肢は「次へ」だけにして、許可/拒否の判断は iOS 標準ダイアログに委ねる
// (App Store Review Guideline 5.1.1(iv) に沿う形)。
export default function TrackingPrompt({ visible, locale, onContinue }: Props) {
  const ja = locale === 'ja';
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Ionicons name="megaphone-outline" size={40} color="#FF4655" style={{ alignSelf: 'center' }} />
          <Text style={styles.title}>{ja ? '広告についてのお願い' : 'About ads'}</Text>
          <Text style={styles.body}>
            {ja
              ? 'V-HUB は広告収入によって無料で提供しています。\n\n次の画面で、広告の表示にトラッキング（他社のアプリやWebサイトをまたいだ利用データ）を使ってよいかを選べます。許可すると、あなたの興味に合った広告が表示されやすくなります。\n\n許可しなくても、アプリの機能はすべてそのまま使えます。設定アプリからいつでも変更できます。'
              : 'V-HUB is free thanks to ads.\n\nOn the next screen you can choose whether ads may use tracking (activity across other companies\' apps and websites). If you allow it, ads are more likely to match your interests.\n\nEither way, every feature stays available. You can change this anytime in Settings.'}
          </Text>
          <TouchableOpacity style={styles.button} onPress={onContinue} accessibilityRole="button">
            <Text style={styles.buttonText}>{ja ? '次へ' : 'Continue'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#1F2933', borderRadius: 14, padding: 24 },
  title: { color: '#ECE8E1', fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginTop: 12, marginBottom: 12 },
  body: { color: '#C7CDD3', fontSize: 14, lineHeight: 21 },
  button: { backgroundColor: '#FF4655', borderRadius: 8, paddingVertical: 12, marginTop: 20, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 },
});
