import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { BALLS, RARITY_ODDS, RARITY_ORDER, describePower, type BallPower, type Rarity } from '@/game/balls';
import { CAPSULE_COST } from '@/game/curve';
import { HARD_PITY, SOFT_PITY } from '@/game/gacha';
import { BOARD_THEMES, themeColorFor, type BoardTheme } from '@/game/themes';
import { tr } from '@/i18n/tr';
import { formatNumber } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useGame } from '@/store/game';
import { CapsuleMachine } from '@/components/space/CapsuleMachine';
import { glassOf } from '@/components/space/cosmos';
import { BackIcon, CoinIcon } from '@/components/space/Icons';
import { Orb } from '@/components/space/Orb';
import { SpaceBackdrop } from '@/components/space/SpaceBackdrop';
import {
  Button,
  Card,
  Confetti,
  HIT_SLOP_MIN,
  IconButton,
  radius,
  Screen,
  SegmentedControl,
  Sheet,
  space,
  Text,
  useColors,
  useScreen,
  useTheme,
} from '@/ui';

type Tab = 'toplar' | 'temalar';

/**
 * The shop: two separate economies under one roof.
 *
 * Toplar is still the capsule/gacha machine — chance, pity, duplicates, the
 * odds printed on the page. Temalar is the opposite on purpose: a flat price,
 * bought outright, no luck involved — a guaranteed way to personalise the
 * board for a player who would rather not gamble for it.
 */
export default function StoreScreen() {
  const router = useRouter();
  const colors = useColors();
  const { scheme } = useTheme();
  const { scale } = useScreen();
  const [tab, setTab] = useState<Tab>('toplar');

  const progress = useGame((s) => s.progress);
  const buyCapsule = useGame((s) => s.buyCapsule);
  const selectBall = useGame((s) => s.selectBall);
  const lastPull = useGame((s) => s.lastPull);
  const clearPull = useGame((s) => s.clearPull);
  const buyTheme = useGame((s) => s.buyTheme);
  const selectTheme = useGame((s) => s.selectTheme);
  const debugUnlockAll = useGame((s) => s.debugUnlockAll);

  const affordable = progress.gold >= CAPSULE_COST;
  const owned = new Set(progress.owned);

  // A short "spin" before the real result shows — cycling through random
  // ball colours — so a pull reads as a reveal, not a lookup. The result
  // itself is already decided (it lives in `lastPull` the instant the
  // capsule is bought); this only delays SHOWING it, purely for the moment.
  const [spinning, setSpinning] = useState(false);
  const [spinColor, setSpinColor] = useState(BALLS[0]!.color);

  useEffect(() => {
    if (lastPull === null) return;
    setSpinning(true);
    let tick = 0;
    const id = setInterval(() => {
      tick += 1;
      setSpinColor(BALLS[Math.floor(Math.random() * BALLS.length)]!.color);
      if (tick >= 8) {
        clearInterval(id);
        setSpinning(false);
        haptic[lastPull.duplicate ? 'select' : 'success']();
      }
    }, 80);
    return () => clearInterval(id);
    // Only the identity of a NEW pull should restart the spin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPull?.ball.id, lastPull?.duplicate, lastPull === null]);

  return (
    <Screen
      scroll
      backdrop={<SpaceBackdrop variant="calm" />}
      footer={
        tab === 'toplar' ? (
          <Button
            label={`${tr.capsule.open} · ${tr.capsule.cost.replace('{cost}', String(CAPSULE_COST))}`}
            disabled={!affordable}
            onPress={async () => {
              await buyCapsule();
            }}
          />
        ) : undefined
      }>
      <View style={{ gap: space.xl }}>
        <View style={{ gap: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <IconButton accessibilityLabel={tr.common.back} tinted onPress={() => router.back()}>
              <BackIcon size={scale(22)} color={colors.text} />
            </IconButton>
            <Text variant="title" style={{ flex: 1 }}>
              {tr.game.store}
            </Text>
            <View
              accessible
              accessibilityLabel={`${tr.game.gold}: ${formatNumber(progress.gold)}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                minHeight: HIT_SLOP_MIN,
                paddingHorizontal: space.md,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: glassOf(colors.surface, scheme),
              }}>
              <CoinIcon size={scale(18)} color={colors.warning} />
              <Text variant="label" numeric>
                {formatNumber(progress.gold)}
              </Text>
            </View>
          </View>
          {/* TEMPORARY test button — remove along with debugUnlockAll once
              testing is done. */}
          <Button label="Test: hepsini aç" variant="ghost" onPress={() => void debugUnlockAll()} />
        </View>

        <SegmentedControl
          accessibilityLabel={tr.game.store}
          segments={[
            { value: 'toplar', label: tr.capsule.tabBalls },
            { value: 'temalar', label: tr.capsule.tabThemes },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'toplar' ? (
          <BallsTab affordable={affordable} owned={owned} selected={progress.selected} onSelect={selectBall} />
        ) : (
          <ThemesTab
            gold={progress.gold}
            ownedThemes={new Set(progress.ownedThemes)}
            selected={progress.boardTheme}
            onBuy={buyTheme}
            onSelect={selectTheme}
          />
        )}
      </View>

      <Sheet visible={lastPull !== null} onClose={clearPull} title={tr.capsule.title}>
        {lastPull === null ? null : (
          <View style={{ gap: space.lg, alignItems: 'center' }}>
            {spinning ? (
              <>
                <Orb size={scale(88)} color={spinColor} glow />
                <Text variant="body" color="textMuted">
                  …
                </Text>
              </>
            ) : (
              <>
                {lastPull.duplicate ? null : <Confetti play />}

                <Orb size={scale(88)} color={lastPull.ball.color} glow />
                <Text variant="title">{lastPull.ball.name}</Text>
                <Text variant="body" color="textMuted">
                  {tr.capsule.rarity[lastPull.ball.rarity]}
                </Text>

                <PowerLines power={lastPull.ball.power} />

                <Text variant="body" color={lastPull.duplicate ? 'textMuted' : 'accent'}>
                  {lastPull.duplicate
                    ? tr.capsule.duplicate.replace('{refund}', String(lastPull.refund))
                    : tr.capsule.isNew}
                </Text>

                <Button label={tr.common.done} onPress={clearPull} />
              </>
            )}
          </View>
        )}
      </Sheet>
    </Screen>
  );
}

function BallsTab({
  affordable,
  owned,
  selected,
  onSelect,
}: {
  affordable: boolean;
  owned: Set<string>;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const colors = useColors();
  const { scale } = useScreen();
  const { content } = useScreen();

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ alignItems: 'center' }}>
        <CapsuleMachine width={content * 0.62} accent={colors.accent} />
      </View>
      {affordable ? null : (
        <Text variant="caption" color="textMuted">
          {tr.capsule.notEnough}
        </Text>
      )}

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
            {tr.capsule.pityBody.replace('{soft}', String(SOFT_PITY)).replace('{hard}', String(HARD_PITY))}
          </Text>
        </View>
      </Card>

      <View style={{ gap: space.md }}>
        <Text variant="heading">
          {tr.capsule.collection} ·{' '}
          {tr.capsule.owned.replace('{owned}', String(owned.size)).replace('{total}', String(BALLS.length))}
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {BALLS.map((ball) => {
            const have = owned.has(ball.id);
            const active = selected === ball.id;
            const lines = have ? describePower(ball.power) : [];

            return (
              <Card
                key={ball.id}
                style={{
                  width: '47%',
                  borderColor: active ? colors.accent : colors.border,
                  borderWidth: active ? 2 : 1,
                }}>
                <View style={{ gap: space.sm, alignItems: 'center' }}>
                  {have ? (
                    <Orb size={scale(48)} color={ball.color} glow={active} />
                  ) : (
                    <View
                      style={{
                        width: scale(48),
                        height: scale(48),
                        borderRadius: radius.pill,
                        backgroundColor: colors.surfaceAlt,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Text variant="heading" color="textMuted">
                        ?
                      </Text>
                    </View>
                  )}
                  <Text variant="label">{have ? ball.name : tr.capsule.locked}</Text>
                  <Text variant="caption" color="textMuted">
                    {tr.capsule.rarity[ball.rarity as Rarity]}
                  </Text>
                  {lines.length > 0 ? (
                    <View style={{ gap: 2, alignItems: 'center' }}>
                      {lines.map((line) => (
                        <Text key={line.key} variant="caption" color="accent">
                          {tr.capsule.power[line.key].replace('{n}', String(line.value))}
                        </Text>
                      ))}
                    </View>
                  ) : have ? (
                    <Text variant="caption" color="textMuted">
                      {tr.capsule.power.none}
                    </Text>
                  ) : null}
                  {have ? (
                    <Button
                      label={active ? tr.capsule.selected : tr.capsule.select}
                      variant={active ? 'ghost' : 'secondary'}
                      disabled={active}
                      onPress={() => onSelect(ball.id)}
                    />
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function ThemesTab({
  gold,
  ownedThemes,
  selected,
  onBuy,
  onSelect,
}: {
  gold: number;
  ownedThemes: Set<string>;
  selected: string;
  onBuy: (id: string) => Promise<boolean>;
  onSelect: (id: string) => Promise<void>;
}) {
  const colors = useColors();

  return (
    <View style={{ gap: space.md }}>
      <Text variant="heading">
        {tr.theme.title} · {tr.theme.owned.replace('{owned}', String(ownedThemes.size)).replace('{total}', String(BOARD_THEMES.length))}
      </Text>
      <Text variant="caption" color="textMuted">
        {tr.theme.hint}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {BOARD_THEMES.map((boardTheme) => {
          const have = ownedThemes.has(boardTheme.id);
          const active = selected === boardTheme.id;
          const swatch = boardTheme.palette?.[0] ?? boardTheme.accent ?? colors.accent;
          const afford = gold >= boardTheme.price;

          return (
            <Card
              key={boardTheme.id}
              style={{
                width: '47%',
                borderColor: active ? colors.accent : colors.border,
                borderWidth: active ? 2 : 1,
              }}>
              <View style={{ gap: space.sm, alignItems: 'center' }}>
                <ThemePreview theme={boardTheme} fallback={swatch} />
                <Text variant="label">{boardTheme.name}</Text>
                <Text variant="caption" color="textMuted">
                  {boardTheme.price === 0 ? tr.theme.free : tr.theme.price.replace('{price}', String(boardTheme.price))}
                </Text>

                {have ? (
                  <Button
                    label={active ? tr.theme.selected : tr.theme.select}
                    variant={active ? 'ghost' : 'secondary'}
                    disabled={active}
                    onPress={() => void onSelect(boardTheme.id)}
                  />
                ) : (
                  <Button
                    label={tr.theme.buy}
                    variant="secondary"
                    disabled={!afford}
                    onPress={() => void onBuy(boardTheme.id)}
                  />
                )}
                {!have && !afford ? (
                  <Text variant="caption" color="textMuted">
                    {tr.theme.notEnough}
                  </Text>
                ) : null}
              </View>
            </Card>
          );
        })}
      </View>
    </View>
  );
}

function PowerLines({ power }: { power: BallPower | undefined }) {
  const lines = describePower(power);
  if (lines.length === 0) {
    return (
      <Text variant="caption" color="textMuted">
        {tr.capsule.power.none}
      </Text>
    );
  }
  return (
    <View style={{ gap: 2, alignItems: 'center' }}>
      {lines.map((line) => (
        <Text key={line.key} variant="caption" color="accent">
          {tr.capsule.power[line.key].replace('{n}', String(line.value))}
        </Text>
      ))}
    </View>
  );
}

/** A 3×2 corner of a board in the theme's own style — what buying it gets. */
function ThemePreview({ theme, fallback }: { theme: BoardTheme; fallback: string }) {
  const colors = useColors();
  const { scale } = useScreen();
  const cell = scale(20);
  const filled = [0, 2, 4];
  return (
    <View
      style={{
        padding: space.xs,
        borderRadius: radius.md,
        backgroundColor: theme.style === 'outline' ? colors.bg : colors.surfaceAlt,
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: cell * 3 + space.xs * 2 + space.xs * 2,
        gap: space.xs,
      }}>
      {Array.from({ length: 6 }, (_, i) => {
        const color = themeColorFor(theme, i, fallback);
        const on = filled.includes(i);
        return (
          <View
            key={i}
            style={{
              width: cell,
              height: cell,
              borderRadius: radius.sm / 2,
              backgroundColor: on && theme.style === 'filled' ? color : 'transparent',
              borderWidth: on && theme.style === 'outline' ? 2 : on ? 0 : 1,
              borderColor: on ? color : colors.border,
              boxShadow: on && theme.glow ? `0 0 ${space.sm}px ${color}` : undefined,
            }}
          />
        );
      })}
    </View>
  );
}
