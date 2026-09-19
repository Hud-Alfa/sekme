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
 * The board itself. It owns no rules and no physics — GameBoard runs the
 * frame loop on the UI thread, the store owns persistence, and `src/game`
 * decides everything else. This screen only ever shows an in-progress run;
 * starting or resuming one happens on the home screen.
 */
export default function PlayScreen() {
  const router = useRouter();
  const onboardingDone = useSettings((s) => s.onboardingDone);

  const game = useGame((s) => s.game);
  const progress = useGame((s) => s.progress);
  const resolveTurn = useGame((s) => s.resolveTurn);
  const newGame = useGame((s) => s.newGame);

  const { content, height: screenHeight } = useScreen();
  const [showOver, setShowOver] = useState(false);
  const [showRestart, setShowRestart] = useState(false);
  const [resolving, setResolving] = useState(false);
  // The real available height for the board's own frame — measured via
  // onLayout rather than guessed, so the frame (and the width it derives)
  // matches this exact device instead of a rough multiplier. Seeded with a
  // reasonable guess so nothing flashes at 0 before the first layout pass.
  const [frameHeight, setFrameHeight] = useState(screenHeight * 0.75);

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
    if (game?.over) {
      haptic.error();
      setShowOver(true);
    }
  }, [game?.over]);

  if (!onboardingDone) return <Redirect href="/onboarding" />;
  // Landed here without a run — home is what decides whether to resume one
  // or start fresh, so there is nothing to do here but go back to it.
  if (game === null) return <Redirect href="/" />;

  // The board has to fit whatever is left after the header, on the shortest
  // phone as well as the tallest. Nothing here is a fixed number: the width
  // is capped by the column count and by the measured frame height.
  const boardWidth = Math.min(content, (frameHeight / ROWS) * COLUMNS);

  return (
    <Screen>
      <View style={{ flex: 1, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <IconButton accessibilityLabel={tr.common.back} tinted onPress={() => router.back()}>
            <Text variant="heading">‹</Text>
          </IconButton>
          <View style={{ flex: 1, flexDirection: 'row', gap: space.lg }}>
            <Stat label={tr.game.score} value={formatNumber(game.turn)} />
            <Stat label={tr.game.best} value={formatNumber(progress.highScores[game.difficulty])} />
            <Stat label={tr.game.gold} value={formatNumber(progress.gold)} />
          </View>
          {game.over ? null : (
            <IconButton
              accessibilityLabel={tr.game.restart}
              tinted
              onPress={() => setShowRestart(true)}>
              <Text variant="heading">↺</Text>
            </IconButton>
          )}
        </View>

        {/* The board is column-width-bound, not height-bound — on a 7-wide
            board there is always slack left over on a tall phone. Rather than
            push that slack to one edge, GameBoard now draws its own frame the
            full measured height and fills it — bordered, on-theme, with a
            faint grid under the empty rows — so what used to be bare black
            reads as the arena's own design instead of leftover space. */}
        <View style={{ flex: 1, alignItems: 'center' }} onLayout={(e) => setFrameHeight(e.nativeEvent.layout.height)}>
          <GameBoard
            board={game.board}
            ballCount={game.balls + liveBonus.balls}
            launchX={game.launchX}
            ballId={progress.selected}
            boardThemeId={progress.boardTheme}
            width={boardWidth}
            frameHeight={frameHeight}
            locked={resolving || game.over}
            onProgress={(p) => setLiveBonus({ balls: p.ballsCollected, gold: p.goldCollected })}
            onTurnComplete={async (result) => {
              setResolving(true);
              await resolveTurn(result);
              setResolving(false);
            }}
          />
        </View>
      </View>

      <Sheet visible={showOver} onClose={() => setShowOver(false)} title={tr.game.over}>
        <View style={{ gap: space.lg }}>
          <Text variant="body" color="textMuted">
            {tr.game.overBody}
          </Text>

          {game.turn >= progress.highScores[game.difficulty] ? (
            <Text variant="heading" color="accent">
              {tr.game.newRecord}
            </Text>
          ) : null}

          <Text variant="title">
            {tr.game.score}: {formatNumber(game.turn)}
          </Text>
          <Text variant="body" color="textMuted">
            {tr.game.goldEarned}: {formatNumber(game.gold)}
          </Text>

          <Button
            label={tr.game.again}
            onPress={() => {
              setShowOver(false);
              router.replace('/');
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
              // Same difficulty, a fresh board — "sıfırla" means restart this
              // run, not abandon it back to the home screen.
              await newGame(game.difficulty);
            }}
          />
          <Button label={tr.common.cancel} variant="ghost" onPress={() => setShowRestart(false)} />
        </View>
      </Sheet>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="heading" numeric>
        {value}
      </Text>
    </View>
  );
}
