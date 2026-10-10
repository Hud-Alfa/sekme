import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { boardWidthFor, GameBoard } from '@/components/GameBoard';
import { BackIcon, RestartIcon } from '@/components/space/Icons';
import { Robot } from '@/components/space/Robot';
import { SpaceBackdrop } from '@/components/space/SpaceBackdrop';
import { findBall } from '@/game/balls';
import { tr } from '@/i18n/tr';
import { playSfx, startMusic, stopMusic } from '@/lib/audio';
import { formatNumber } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { useGame } from '@/store/game';
import { useSettings } from '@/store/settings';
import {
  Button,
  Confetti,
  IconButton,
  NumberRoll,
  radius,
  Screen,
  Sheet,
  StatTile,
  space,
  Text,
  useColors,
  useScreen,
} from '@/ui';

/**
 * The board itself. It owns no rules and no physics — GameBoard runs the
 * frame loop on the UI thread, the store owns persistence, and `src/game`
 * decides everything else. This screen only ever shows an in-progress run;
 * starting or resuming one happens on the home screen.
 */
export default function PlayScreen() {
  const router = useRouter();
  const colors = useColors();
  const onboardingDone = useSettings((s) => s.onboardingDone);

  const game = useGame((s) => s.game);
  const progress = useGame((s) => s.progress);
  const resolveTurn = useGame((s) => s.resolveTurn);
  const newGame = useGame((s) => s.newGame);

  const { content, height: screenHeight, scale, isShort } = useScreen();
  const insets = useSafeAreaInsets();
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
      // Read at the moment the run ends rather than from the render above:
      // this fires once, and by the next render the store has already banked
      // the new high score, which would make every run look like a record.
      const { game: ended, progress: banked } = useGame.getState();
      playSfx(ended && ended.turn > banked.highScores[ended.difficulty] ? 'rekor' : 'bitti');
      setShowOver(true);
    }
  }, [game?.over]);

  // Music belongs to this screen, not the app: it starts when the board is in
  // front of someone and stops the moment they leave, so the menu and the
  // store stay silent and nothing keeps playing off-screen.
  useFocusEffect(
    useCallback(() => {
      startMusic();
      return stopMusic;
    }, []),
  );

  if (!onboardingDone) return <Redirect href="/onboarding" />;
  // Landed here without a run — home is what decides whether to resume one
  // or start fresh, so there is nothing to do here but go back to it.
  if (game === null) return <Redirect href="/" />;

  // The board has to fit whatever is left after the header, on the shortest
  // phone as well as the tallest. Nothing here is a fixed number: the width
  // is capped by the column count and by the measured frame height.
  const boardWidth = boardWidthFor(frameHeight, content);

  const isNewRecord = game.turn >= progress.highScores[game.difficulty];

  // Back, the stats and restart used to sit in their own row above the
  // board, leaving the panel's own top edge empty. They ride inside the
  // panel's frame now instead — GameBoard renders this at the frame's own
  // top, so that space actually holds something rather than just being
  // border and background. The three stats themselves moved from bare
  // stacked text to filled chips — a row of plain numbers on a busy board
  // read as an afterthought; a chip each gives them a floor to sit on, the
  // same "surfaceAlt behind a value" language `StatTile` uses elsewhere,
  // just slim enough to fit next to the back/restart buttons. Skor gets the
  // accent tone — the one other place besides a primary action this screen
  // is allowed one, and it is this screen's own main data.
  const header = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <IconButton accessibilityLabel={tr.common.back} tinted onPress={() => router.back()}>
        <BackIcon size={scale(22)} color={colors.text} />
      </IconButton>
      <View style={{ flex: 1, flexDirection: 'row', gap: space.xs }}>
        <StatChip label={tr.game.score} value={formatNumber(game.turn)} tone="accent" />
        <StatChip label={tr.game.best} value={formatNumber(progress.highScores[game.difficulty])} />
        <StatChip label={tr.game.gold} value={formatNumber(progress.gold)} />
      </View>
      {game.over ? null : (
        <IconButton accessibilityLabel={tr.game.restart} tinted onPress={() => setShowRestart(true)}>
          <RestartIcon size={scale(20)} color={colors.text} />
        </IconButton>
      )}
    </View>
  );

  return (
    <Screen backdrop={<SpaceBackdrop variant="calm" />}>
      {/* The board is column-width-bound, not height-bound — on a 7-wide
          board there is always slack left over on a tall phone. Rather than
          push that slack to one edge, GameBoard now draws its own frame the
          full measured height and fills it — bordered, on-theme, with a
          faint grid under the empty rows — so what used to be bare black
          reads as the arena's own design instead of leftover space. */}
      <View
        style={{ flex: 1, alignItems: 'center', marginBottom: insets.bottom + space.sm }}
        onLayout={(e) => setFrameHeight(e.nativeEvent.layout.height)}>
        <GameBoard
          board={game.board}
          ballCount={game.balls + liveBonus.balls}
          launchX={game.launchX}
          ballId={progress.selected}
          boardThemeId={progress.boardTheme}
          width={boardWidth}
          frameHeight={frameHeight}
          header={header}
          locked={resolving || game.over}
          over={game.over}
          onProgress={(p) => setLiveBonus({ balls: p.ballsCollected, gold: p.goldCollected })}
          onTurnComplete={async (result) => {
            setResolving(true);
            await resolveTurn(result);
            setResolving(false);
          }}
        />
      </View>

      <Sheet visible={showOver} onClose={() => setShowOver(false)}>
        <View style={{ gap: space.xl, alignItems: 'center' }}>
          {/* A record is the one moment this screen celebrates — everything
              else here is a plain result, on purpose, so this stays worth
              noticing per `tasarim-sistemi`'s "don't inflate celebration". */}
          {isNewRecord ? <Confetti play /> : null}

          {/* The robot reacts to the run: arm up with a ball on a record,
              a sad face otherwise — the one character the player has been
              firing with all run, not a bare number. */}
          <Robot
            size={scale(isShort ? 64 : 88)}
            accent={colors.accent}
            ballColor={findBall(progress.selected).color}
            mood={isNewRecord ? 'happy' : 'sad'}
            pose={isNewRecord ? 'throw' : 'idle'}
          />

          <View style={{ alignItems: 'center', gap: space.xs }}>
            <Text variant="body" color="textMuted">
              {tr.game.over}
            </Text>
            <NumberRoll value={game.turn} variant="display" style={{ color: colors.text }} />
            <Text variant="caption" color="textMuted">
              {tr.game.score}
            </Text>
          </View>

          {isNewRecord ? (
            <Text variant="heading" color="accent">
              {tr.game.newRecord}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: space.md, width: '100%' }}>
            <StatTile
              value={formatNumber(progress.highScores[game.difficulty])}
              label={tr.game.best}
              tone={isNewRecord ? 'accent' : 'text'}
            />
            <StatTile value={formatNumber(game.gold)} label={tr.game.goldEarned} tone="warning" />
          </View>

          <View style={{ width: '100%', gap: space.sm }}>
            <Button
              label={tr.game.again}
              onPress={async () => {
                setShowOver(false);
                await newGame(game.difficulty);
              }}
            />
            <Button
              label={tr.game.backToMenu}
              variant="ghost"
              onPress={() => {
                setShowOver(false);
                router.replace('/');
              }}
            />
          </View>
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

function StatChip({
  label,
  value,
  tone = 'text',
}: {
  label: string;
  value: string;
  tone?: 'text' | 'accent';
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        gap: 2,
        paddingHorizontal: space.sm,
        paddingVertical: space.xs,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceAlt,
      }}>
      <Text variant="caption" color="textMuted" numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
      <Text variant="label" color={tone} numeric numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}
