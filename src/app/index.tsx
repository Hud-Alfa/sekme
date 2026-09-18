import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { GameBoard } from '@/components/GameBoard';
import { tr } from '@/i18n/tr';
import { COLUMNS, ROWS } from '@/game/curve';
import { formatNumber } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useGame } from '@/store/game';
import { useSettings } from '@/store/settings';
import { Button, IconButton, Screen, Sheet, space, Text, useScreen } from '@/ui';

/**
 * The game screen. It owns no rules and no physics — the board component runs
 * the frame loop on the UI thread, the store owns persistence, and `src/game`
 * decides everything else.
 */
export default function GameScreen() {
  const router = useRouter();
  const onboardingDone = useSettings((s) => s.onboardingDone);

  const load = useGame((s) => s.load);
  const ready = useGame((s) => s.ready);
  const game = useGame((s) => s.game);
  const progress = useGame((s) => s.progress);
  const newGame = useGame((s) => s.newGame);
  const resolveTurn = useGame((s) => s.resolveTurn);

  const { content, height: screenHeight } = useScreen();
  const [showOver, setShowOver] = useState(false);
  const [showRestart, setShowRestart] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Balls/gold collected so far in the shot currently in flight. GameBoard
  // reports a running total for the turn, not a delta, so this is simply set
  // — and reset to zero the moment `game.balls` itself changes, which is the
  // point the store has already folded that same total into the real count.
  const [liveBonus, setLiveBonus] = useState({ balls: 0, gold: 0 });
  const [syncedBalls, setSyncedBalls] = useState(game?.balls);
  if (game?.balls !== syncedBalls) {
    setSyncedBalls(game?.balls);
    setLiveBonus({ balls: 0, gold: 0 });
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (game?.over) {
      haptic.error();
      setShowOver(true);
    }
  }, [game?.over]);

  if (!onboardingDone) return <Redirect href="/onboarding" />;

  // The board has to fit whatever is left after the header and the launch
  // strip, on the shortest phone as well as the tallest. Nothing here is a
  // fixed number: the width is capped by the column and by the height budget.
  const heightBudget = screenHeight * 0.62;
  const boardWidth = Math.min(content, (heightBudget / ROWS) * COLUMNS);

  return (
    <Screen>
      <View style={{ flex: 1, gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="textMuted">
              {tr.game.score}
            </Text>
            <Text variant="title">{formatNumber(game?.turn ?? 0)}</Text>
          </View>
          <View>
            <Text variant="caption" color="textMuted">
              {tr.game.best}
            </Text>
            <Text variant="heading">{formatNumber(progress.highScore)}</Text>
          </View>
          <Button
            label={`${tr.game.gold} ${formatNumber(progress.gold)}`}
            variant="secondary"
            block={false}
            onPress={() => router.push('/kapsul')}
          />
          {game !== null && !game.over ? (
            <IconButton
              accessibilityLabel={tr.game.restart}
              tinted
              onPress={() => setShowRestart(true)}>
              <Text variant="heading">↺</Text>
            </IconButton>
          ) : null}
          <IconButton
            accessibilityLabel={tr.settings.title}
            tinted
            onPress={() => router.push('/ayarlar')}>
            <Text variant="heading">⚙</Text>
          </IconButton>
        </View>

        {ready && game === null ? (
          <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
            <Text variant="title">{tr.app.name}</Text>
            <Text variant="body" color="textMuted">
              {tr.game.aimHint}
            </Text>
            <Button label={tr.game.newGame} onPress={() => void newGame()} />
          </View>
        ) : game === null ? null : (
          <>
            <GameBoard
              board={game.board}
              ballCount={game.balls}
              launchX={game.launchX}
              ballId={progress.selected}
              width={boardWidth}
              locked={resolving || game.over}
              onProgress={(p) => setLiveBonus({ balls: p.ballsCollected, gold: p.goldCollected })}
              onTurnComplete={async (result) => {
                setResolving(true);
                await resolveTurn(result);
                setResolving(false);
              }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Text variant="heading" style={{ flex: 1 }}>
                ×{formatNumber(game.balls + liveBonus.balls)} {tr.game.balls}
              </Text>
              <Text variant="caption" color="textMuted">
                {tr.game.aimHint}
              </Text>
            </View>
          </>
        )}
      </View>

      <Sheet
        visible={showOver}
        onClose={() => setShowOver(false)}
        title={tr.game.over}>
        <View style={{ gap: space.lg }}>
          <Text variant="body" color="textMuted">
            {tr.game.overBody}
          </Text>

          {game !== null && game.turn >= progress.highScore ? (
            <Text variant="heading" color="accent">
              {tr.game.newRecord}
            </Text>
          ) : null}

          <Text variant="title">
            {tr.game.score}: {formatNumber(game?.turn ?? 0)}
          </Text>
          <Text variant="body" color="textMuted">
            {tr.game.goldEarned}: {formatNumber(game?.gold ?? 0)}
          </Text>

          <Button
            label={tr.game.again}
            onPress={async () => {
              setShowOver(false);
              await newGame();
            }}
          />
          <Button
            label={tr.capsule.title}
            variant="secondary"
            onPress={() => {
              setShowOver(false);
              router.push('/kapsul');
            }}
          />
        </View>
      </Sheet>

      <Sheet
        visible={showRestart}
        onClose={() => setShowRestart(false)}
        title={tr.game.restartConfirmTitle}>
        <View style={{ gap: space.lg }}>
          <Text variant="body" color="textMuted">
            {tr.game.restartConfirmBody}
          </Text>
          <Button
            label={tr.game.restartConfirmAction}
            variant="danger"
            onPress={async () => {
              setShowRestart(false);
              await newGame();
            }}
          />
          <Button
            label={tr.common.cancel}
            variant="ghost"
            onPress={() => setShowRestart(false)}
          />
        </View>
      </Sheet>
    </Screen>
  );
}
