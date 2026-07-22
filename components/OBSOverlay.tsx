import React, { useEffect, useRef, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { gsap } from 'gsap';
import { db } from '../services/storage';
import styles from './obs.module.css';
import { MatchupLogo } from './MatchupLogo';
import { Match, MatchStatus } from '../types';

export default function OBSOverlay({ matchId, tournamentId }: { matchId: string, tournamentId?: string }) {
  const [match, setMatch] = useState<Match | null>(null);

  // Refs for GSAP targets
  const stingLayerRef  = useRef<HTMLDivElement>(null);
  const stingRuleRef   = useRef<HTMLDivElement>(null);
  const stingBodyRef   = useRef<HTMLDivElement>(null);
  const stingLine1Ref  = useRef<HTMLSpanElement>(null);
  const stingLine2Ref  = useRef<HTMLSpanElement>(null);

  // Score change detection
  const prevSetsRef    = useRef<Array<{ team1: number; team2: number; p1Pts: string; p2Pts: string; }>>([]);
  const scoreRefs      = useRef<Record<string, HTMLDivElement | null>>({});
  const points1Ref     = useRef<HTMLSpanElement>(null);
  const points2Ref     = useRef<HTMLSpanElement>(null);

  // Sting timer
  const stingActiveRef = useRef(false);
  const stingTimerRef  = useRef<NodeJS.Timeout | NodeJS.Timer | null>(null);

  // ── Firestore listener ──────────────────────────────────────────
  useEffect(() => {
    const bootstrap = async () => {
      let tId = tournamentId;
      if (!tId) {
        const idx = await getDoc(doc(db, 'obsIndex', matchId));
        if (idx.exists()) {
          tId = idx.data().tournamentId;
        } else {
            // Also attempt global matches if obsIndex isn't there
            const globalRef = await getDoc(doc(db, "matches", matchId));
            if (globalRef.exists()) tId = globalRef.data().tournamentId;
        }
      }
      if (!tId) return;

      const matchRef = doc(db, 'tournaments', tId, 'matches', matchId);
      return onSnapshot(matchRef, (snap) => {
        if (snap.exists()) setMatch(snap.data() as Match);
      });
    };
    const unsubPromise = bootstrap();
    return () => { unsubPromise.then(u => u && u()); };
  }, [matchId, tournamentId]);

  // Derived sets mapped from Match schema
  const isCompleted = match?.status === 'COMPLETED' || String(match?.status).toUpperCase() === 'COMPLETED' || match?.winnerTeamId;
  const setsCount = Math.max(match?.score?.p1SetScores?.length || 0, match?.score?.p2SetScores?.length || 0);
  const mappedSets = [];

  for (let i = 0; i < setsCount; i++) {
      mappedSets.push({
          team1: match?.score?.p1SetScores[i] || 0,
          team2: match?.score?.p2SetScores[i] || 0,
      });
  }

  if (!isCompleted && match?.status !== MatchStatus.SCHEDULED) {
      mappedSets.push({
          team1: match?.score?.p1Games || 0,
          team2: match?.score?.p2Games || 0,
      });
  }

  // ── Score change animation ───────────────────────────────────────
  useEffect(() => {
    if (!match) return;

    const currentSets = mappedSets.map(s => ({ ...s, p1Pts: match.score?.p1Points || '0', p2Pts: match.score?.p2Points || '0' }));
    const prevSets = prevSetsRef.current;

    currentSets.forEach((set, setIdx) => {
      const prev = prevSets[setIdx] || { team1: 0, team2: 0, p1Pts: '0', p2Pts: '0' };

      if (set.team1 !== prev.team1) animateScoreBox(`t1s${setIdx}`);
      if (set.team2 !== prev.team2) animateScoreBox(`t2s${setIdx}`);
    });

    if (currentSets.length > 0) {
        const lastCurrent = currentSets[currentSets.length - 1];
        const lastPrev = prevSets.length > 0 ? prevSets[prevSets.length - 1] : { p1Pts: '0', p2Pts: '0' };
        if (lastCurrent.p1Pts !== lastPrev.p1Pts) animatePointsBox(points1Ref.current);
        if (lastCurrent.p2Pts !== lastPrev.p2Pts) animatePointsBox(points2Ref.current);
    }

    prevSetsRef.current = currentSets.map(s => ({ ...s }));
  }, [match?.score?.p1SetScores, match?.score?.p2SetScores, match?.score?.p1Games, match?.score?.p2Games, match?.score?.p1Points, match?.score?.p2Points]);

  const animateScoreBox = (key: string) => {
    const el = scoreRefs.current[key];
    if (!el) return;
    gsap.fromTo(el,
      { scale: 1, backgroundColor: 'rgba(26,86,219,0.55)', borderColor: '#4a7dfa' },
      {
        scale: 1.55,
        backgroundColor: 'rgba(26,86,219,0.95)',
        borderColor: '#6b9fff',
        duration: 0.18,
        ease: 'power3.out',
        yoyo: true,
        repeat: 1,
        onComplete: () => gsap.set(el, { scale: 1, clearProps: 'backgroundColor,borderColor' }),
      }
    );
  };

  const animatePointsBox = (el: HTMLElement | null) => {
      if (!el) return;
      gsap.fromTo(el,
        { scale: 1, color: '#FFFFFF', textShadow: 'none' },
        {
          scale: 1.35,
          color: '#00E5FF',
          textShadow: '0 0 10px rgba(0,229,255,0.8)',
          duration: 0.18,
          ease: 'power3.out',
          yoyo: true,
          repeat: 1,
          onComplete: () => gsap.set(el, { scale: 1, clearProps: 'all' }),
        }
      );
  };

  // ── Logo sting ───────────────────────────────────────────────────
  const triggerSting = () => {
    if (stingActiveRef.current) return;
    stingActiveRef.current = true;

    const layer = stingLayerRef.current;
    const rule  = stingRuleRef.current;
    const body  = stingBodyRef.current;
    const l1    = stingLine1Ref.current;
    const l2    = stingLine2Ref.current;
    if (!layer || !rule || !body || !l1 || !l2) return;

    gsap.set(layer, { display: 'flex', opacity: 0 });
    gsap.set(rule,  { width: '0%', opacity: 1 });
    gsap.set(body,  { opacity: 0, scale: 0.58 });
    gsap.set([l1, l2], { opacity: 0, y: 5 });

    gsap.timeline({ onComplete: () => { stingActiveRef.current = false; } })
      .to(layer, { opacity: 1,  duration: 0.28, ease: 'power2.out' })
      .to(rule,  { width: '90%', duration: 0.44, ease: 'power3.inOut' }, '-=0.05')
      .to(body,  { opacity: 1, scale: 1, duration: 0.50, ease: 'back.out(2.4)' }, '-=0.20')
      .to(l1,    { opacity: 1, y: 0, duration: 0.30, ease: 'power2.out' }, '-=0.25')
      .to(l2,    { opacity: 1, y: 0, duration: 0.30, ease: 'power2.out' }, '-=0.18')
      .to({},    { duration: 2.0 })
      .to([body, l1, l2], { opacity: 0, y: -8, duration: 0.28, ease: 'power2.in', stagger: 0.04 })
      .to(rule,  { width: '0%', opacity: 0, duration: 0.28, ease: 'power3.in' }, '-=0.20')
      .to(layer, { opacity: 0, duration: 0.22, ease: 'power2.in' }, '-=0.10')
      .set(layer, { display: 'none' });
  };

  // ── 60-second sting interval ──────────────────────────────────────
  useEffect(() => {
     document.fonts.ready.then(() => {
        if (stingTimerRef.current) clearInterval(stingTimerRef.current as NodeJS.Timeout);
        stingTimerRef.current = setInterval(triggerSting, 60_000);
     });
    return () => { if (stingTimerRef.current) clearInterval(stingTimerRef.current as NodeJS.Timeout); };
  }, [match?.score]);

  // ── Helpers ───────────────────────────────────────────────────────
  const isWinningSet = (team: 'team1' | 'team2', setIdx: number) => {
    const s = mappedSets[setIdx];
    if (!s) return false;
    return team === 'team1' ? s.team1 > s.team2 && setIdx < setsCount : s.team2 > s.team1 && setIdx < setsCount;
  };

  if (!match || match.status === MatchStatus.SCHEDULED || (match.status === MatchStatus.COMPLETED || String(match.status).toUpperCase() === 'FINISHED')) return null; // blank page until match goes live and not when it's done

  const t1Name = match.team1Name || (match.team1Id ? 'TEAM 1' : 'TBD');
  const t2Name = match.team2Name || (match.team2Id ? 'TEAM 2' : 'TBD');

  return (
    <div className={styles.obsPage}>
      <div className={styles.obsCard}>

        {/* ── TEAMS ──────────────────────────────────────────── */}
        <div className={styles.obsBody}>
          <div className={styles.obsLogoWrap}>
            <MatchupLogo className={styles.obsLogoSvg} />
          </div>
          <div className={styles.obsTeams}>
              {/* Team 1 */}
              <div className={styles.obsRow}>
                <span className={styles.obsTname}>{t1Name}</span>
                <div className={styles.obsSets}>
                  {mappedSets.map((s, i) => (
                    <div
                      key={i}
                      ref={el => { scoreRefs.current[`t1s${i}`] = el; }}
                      className={`${styles.obsSbox} ${isWinningSet('team1', i) ? styles.win : ''}`}
                    >
                      {s.team1}
                    </div>
                  ))}
                  {!isCompleted && (
                     <div className={`${styles.obsSbox} ${styles.liveScoreValue}`}>
                        <span ref={points1Ref}>{match.score?.p1Points === '0' ? '0' : match.score?.p1Points}</span>
                     </div>
                  )}
                </div>
              </div>
              {/* Team 2 */}
              <div className={styles.obsRow}>
                <span className={styles.obsTname}>{t2Name}</span>
                <div className={styles.obsSets}>
                  {mappedSets.map((s, i) => (
                    <div
                      key={i}
                      ref={el => { scoreRefs.current[`t2s${i}`] = el; }}
                      className={`${styles.obsSbox} ${isWinningSet('team2', i) ? styles.win : ''}`}
                    >
                      {s.team2}
                    </div>
                  ))}
                   {!isCompleted && (
                     <div className={`${styles.obsSbox} ${styles.liveScoreValue}`}>
                        <span ref={points2Ref}>{match.score?.p2Points === '0' ? '0' : match.score?.p2Points}</span>
                     </div>
                  )}
                </div>
              </div>
          </div>
        </div>

        {/* ── STING LAYER ────────────────────────────────────── */}
        <div className={styles.stingLayer} ref={stingLayerRef}>
          <div className={styles.stingRule} ref={stingRuleRef} />
          <div className={styles.stingBody} ref={stingBodyRef}>
            <MatchupLogo className={styles.stingLogo} />
            <div className={styles.stingWords}>
              <span className={styles.stingTaglineTop} ref={stingLine1Ref}>
                THE SPECTATORS
              </span>
              <span className={styles.stingTaglineBot} ref={stingLine2Ref}>
                SPORTS PLATFORM
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
