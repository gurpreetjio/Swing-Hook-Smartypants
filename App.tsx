import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AdventureFlow } from './src/screens/AdventureFlow';
import { GradeSelectScreen } from './src/screens/GradeSelectScreen';
import { HomeScreen, Route } from './src/screens/HomeScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { LockerScreen } from './src/screens/LockerScreen';
import { TournamentScreen } from './src/screens/TournamentScreen';
import { StoreProvider, useStore } from './src/state/store';
import { theme } from './src/theme';

function Root() {
  const { loaded, profile } = useStore();
  const [route, setRoute] = useState<Route>({ name: 'home' });

  if (!loaded) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashLogo}>SWING HOOK</Text>
        <Text style={styles.splashSub}>SMARTYPANTS</Text>
      </View>
    );
  }

  if (profile.grade === null || route.name === 'gradeSelect') {
    return <GradeSelectScreen onDone={() => setRoute({ name: 'home' })} />;
  }

  const goHome = () => setRoute({ name: 'home' });

  switch (route.name) {
    case 'adventure':
      return <AdventureFlow mode={route.mode} onHome={goHome} />;
    case 'tournament':
      return <TournamentScreen onHome={goHome} />;
    case 'leaderboard':
      return <LeaderboardScreen onHome={goHome} />;
    case 'locker':
      return <LockerScreen onHome={goHome} />;
    default:
      return <HomeScreen go={setRoute} />;
  }
}

export default function App() {
  return (
    <StoreProvider>
      <View style={styles.app}>
        <StatusBar style="light" />
        <Root />
      </View>
    </StoreProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: theme.bg },
  splash: { flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  splashLogo: { color: theme.text, fontSize: 34, fontWeight: '900', letterSpacing: 2 },
  splashSub: { color: theme.accent, fontSize: 16, fontWeight: '900', letterSpacing: 8 },
});
