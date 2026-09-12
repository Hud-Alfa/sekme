import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { BALLS, RARITY_ODDS, RARITY_ORDER, type Rarity } from '@/game/balls';
import { CAPSULE_COST } from '@/game/curve';
import { HARD_PITY, SOFT_PITY } from '@/game/gacha';
import { tr } from '@/i18n/tr';
import { formatNumber } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useGame } from '@/store/game';
import {
  Button,
  Card,
  Confetti,
  radius,
  Screen,
  Sheet,
  space,
  Text,
  useColors,
} from '@/ui';

/**
 * The capsule machine and the collection.
 *
 * The odds are printed on the page, not buried: Play requires disclosure for
 * anything of this shape, and a machine that hides its rates has something to
 * hide. Since gold cannot be bought, saying so costs nothing and earns the
 * benefit of the doubt.
 */
export default function CapsuleScreen() {
  const router = useRouter();
  const colors = useColors();

  const progress = useGame((s) => s.progress);
  const buyCapsule = useGame((s) => s.buyCapsule);
  const selectBall = useGame((s) => s.selectBall);
  const lastPull = useGame((s) => s.lastPull);
  const clearPull = useGame((s) => s.clearPull);

  const affordable = progress.gold >= CAPSULE_COST;
  const owned = new Set(progress.owned);

  return (
    <Screen
      scroll
      footer={
        <Button
          label={`${tr.capsule.open} · ${tr.capsule.cost.replace('{cost}', String(CAPSULE_COST))}`}
          disabled={!affordable}
          onPress={async () => {
            const pull = await buyCapsule();
            if (pull) haptic.success();
          }}
        />
      }>
      <View style={{ gap: space.xl }}>
        <View style={{ gap: space.xs }}>
          <Text variant="title">{tr.capsule.title}</Text>
          <Text variant="body" color="textMuted">
            {tr.game.gold}: {formatNumber(progress.gold)}
          </Text>
          {affordable ? null : (
            <Text variant="caption" color="textMuted">
              {tr.capsule.notEnough}
            </Text>
          )}
        </View>

        <Card>
          <View style={{ gap: space.sm }}>
            <Text variant="heading">{tr.capsule.odds}</Text>
            {RARITY_ORDER.map((rarity) => (
              <View key={rarity} style={{ flexDirection: 'row', gap: space.md }}>
                <Text variant="body" color="textMuted" style={{ flex: 1 }}>
                  {tr.capsule.rarity[rarity]}
                </Text>
                <Text variant="body">%{(RARITY_ODDS[rarity] * 100).toFixed(1)}</Text>
              </View>
            ))}
            <Text variant="caption" color="textMuted">
              {tr.capsule.oddsBody}
            </Text>
            <Text variant="caption" color="textMuted">
              {tr.capsule.pityBody
                .replace('{soft}', String(SOFT_PITY))
                .replace('{hard}', String(HARD_PITY))}
            </Text>
          </View>
        </Card>

        <View style={{ gap: space.md }}>
          <Text variant="heading">
            {tr.capsule.collection} ·{' '}
            {tr.capsule.owned
              .replace('{owned}', String(owned.size))
              .replace('{total}', String(BALLS.length))}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            {BALLS.map((ball) => {
              const have = owned.has(ball.id);
              const active = progress.selected === ball.id;

              return (
                <Card
                  key={ball.id}
                  style={{
                    width: '47%',
                    borderColor: active ? colors.accent : colors.border,
                    borderWidth: active ? 2 : 1,
                  }}>
                  <View style={{ gap: space.sm, alignItems: 'center' }}>
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: radius.pill,
                        backgroundColor: have ? ball.color : colors.surfaceAlt,
                        borderWidth: have ? 0 : 1,
                        borderColor: colors.border,
                      }}
                    />
                    <Text variant="label">{have ? ball.name : tr.capsule.locked}</Text>
                    <Text variant="caption" color="textMuted">
                      {tr.capsule.rarity[ball.rarity as Rarity]}
                    </Text>
                    {have ? (
                      <Button
                        label={active ? tr.capsule.selected : tr.capsule.select}
                        variant={active ? 'ghost' : 'secondary'}
                        disabled={active}
                        onPress={() => void selectBall(ball.id)}
                      />
                    ) : null}
                  </View>
                </Card>
              );
            })}
          </View>
        </View>

        <Button label={tr.common.back} variant="ghost" onPress={() => router.back()} />
      </View>

      <Sheet visible={lastPull !== null} onClose={clearPull} title={tr.capsule.title}>
        {lastPull === null ? null : (
          <View style={{ gap: space.lg, alignItems: 'center' }}>
            {lastPull.duplicate ? null : <Confetti play />}

            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: radius.pill,
                backgroundColor: lastPull.ball.color,
              }}
            />
            <Text variant="title">{lastPull.ball.name}</Text>
            <Text variant="body" color="textMuted">
              {tr.capsule.rarity[lastPull.ball.rarity]}
            </Text>

            <Text variant="body" color={lastPull.duplicate ? 'textMuted' : 'accent'}>
              {lastPull.duplicate
                ? tr.capsule.duplicate.replace('{refund}', String(lastPull.refund))
                : tr.capsule.isNew}
            </Text>

            <Button label={tr.common.done} onPress={clearPull} />
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
