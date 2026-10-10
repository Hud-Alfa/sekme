import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { tr } from '@/i18n/tr';
import { useSettings } from '@/store/settings';
import { OnboardingArt } from '@/components/space/OnboardingArt';
import { SpaceBackdrop } from '@/components/space/SpaceBackdrop';
import { Button, duration, radius, Screen, space, Text, useColors, useScreen } from '@/ui';

const steps = tr.onboarding.steps;

export default function OnboardingScreen() {
  const router = useRouter();
  const colors = useColors();
  const { hero, isShort } = useScreen();
  // The art is the page's hero, but it must leave room for two lines of
  // text and the footer on a short phone.
  const art = isShort ? hero * 0.7 : hero * 0.85;
  const complete = useSettings((s) => s.completeOnboarding);
  const [index, setIndex] = useState(0);

  const isLast = index === steps.length - 1;

  function finish() {
    complete();
    router.replace('/');
  }

  return (
    <Screen
      backdrop={<SpaceBackdrop />}
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
          <View style={{ marginBottom: space.xl }}>
            <OnboardingArt step={index} size={art} />
          </View>
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
                width: i === index ? space.xl : space.sm,
                height: space.sm,
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
