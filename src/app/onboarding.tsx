import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { tr } from '@/i18n/tr';
import { useSettings } from '@/store/settings';
import { Button, duration, radius, Screen, space, Text, useColors } from '@/ui';

const steps = tr.onboarding.steps;

export default function OnboardingScreen() {
  const router = useRouter();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const complete = useSettings((s) => s.completeOnboarding);
  const [index, setIndex] = useState(0);

  const isLast = index === steps.length - 1;

  function finish() {
    complete();
    router.replace('/');
  }

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          <Button
            label={isLast ? tr.common.start : tr.common.continue}
            onPress={() => (isLast ? finish() : setIndex((i) => i + 1))}
          />
          {!isLast ? <Button label={tr.common.skip} variant="ghost" onPress={finish} /> : null}
        </View>
      }>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.xxl }}>
        <Animated.View
          key={index}
          entering={FadeIn.duration(duration.base)}
          exiting={FadeOut.duration(duration.fast)}
          style={{ gap: space.md }}>
          <View
            style={{
              width: Math.min(width * 0.5, 200),
              height: Math.min(width * 0.5, 200),
              borderRadius: radius.xl,
              backgroundColor: colors.accentSoft,
              alignSelf: 'center',
              marginBottom: space.xl,
            }}
          />
          <Text variant="title" center>
            {steps[index].title}
          </Text>
          <Text variant="body" color="textMuted" center>
            {steps[index].body}
          </Text>
        </Animated.View>

        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`${index + 1} / ${steps.length}`}
          style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center' }}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 24 : 8,
                height: 8,
                borderRadius: radius.pill,
                backgroundColor: i === index ? colors.accent : colors.border,
              }}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}
