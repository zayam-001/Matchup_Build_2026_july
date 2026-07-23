#!/bin/bash
sed -i '/\/\/ ── Score change animation/i \
  useEffect(() => {\n    if (!cardRef.current || !match) return;\n    if (match.status !== MatchStatus.SCHEDULED) {\n      gsap.fromTo(cardRef.current, \n        { y: 50, opacity: 0, scale: 0.95 }, \n        { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.2)" }\n      );\n    }\n  }, [match?.status]);\n' components/OBSOverlay.tsx
