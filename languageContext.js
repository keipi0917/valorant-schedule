import React, { createContext, useState, useContext } from 'react';

const LanguageContext = createContext();

const translations = {
  ja: {
    upcomingMatches: "今後の試合予定",
    noMatches: "該当する試合はありません",
  },
  en: {
    upcomingMatches: "Upcoming Matches",
    noMatches: "No matches found",
  }
};

export const LanguageProvider = ({ children }) => {
  const [locale, setLocale] = useState('ja');

  // ここで `setLocale` を `value` に含めることで、
  // 他の画面（index.tsxなど）から言語を切り替えられるようになります。
  const value = {
    t: translations[locale],
    locale,
    setLocale, // ★ここが重要です！
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);