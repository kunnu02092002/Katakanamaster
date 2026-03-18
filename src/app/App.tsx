import { useEffect, useMemo, useRef, useState } from "react";
import { speakJapanese } from "../data/audio/speechService";
import { useAppStore } from "../state/useAppStore";
import "../styles/globals.css";

function formatNextReview(nextDate: string) {
  const now = Date.now();
  const due = new Date(nextDate).getTime();
  const days = Math.ceil((due - now) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
}

export default function App() {
  const INITIAL_WORDS_LIMIT = 120;
  const WORDS_LOAD_STEP = 120;

  const [toast, setToast] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showWordsHelp, setShowWordsHelp] = useState(false);
  const [hasShownWordsHelp, setHasShownWordsHelp] = useState(false);
  const [visibleWordsLimit, setVisibleWordsLimit] = useState(INITIAL_WORDS_LIMIT);
  const [loginMode, setLoginMode] = useState<"email" | "phone">("email");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [awaitingPhoneOtp, setAwaitingPhoneOtp] = useState(false);
  const pendingCardChangeTimer = useRef<number | null>(null);

  const {
    initialized,
    initialize,
    activeTab,
    setTab,
    mode,
    setMode,
    search,
    setSearch,
    relatedLetter,
    setRelatedLetter,
    letters,
    words,
    dueCount,
    streak,
    selectedLetter,
    setSelectedLetter,
    cardFlipped,
    toggleFlip,
    flashIndex,
    setFlashIndex,
    gradeCard,
    cloudConfigured,
    cloudConnected,
    cloudUserEmail,
    cloudUserPhone,
    cloudSyncState,
    cloudMessage,
    signInCloudEmail,
    signInCloudPhone,
    verifyCloudPhoneOtp,
    signOutCloud,
    syncCloudNow,
  } = useAppStore();

  useEffect(() => {
    initialize().catch((error) => {
      console.error(error);
      alert("Failed to initialize app data.");
    });
  }, [initialize]);

  const filteredWords = useMemo(() => {
    return words.filter((item) => {
      if (relatedLetter && !item.front.includes(relatedLetter)) {
        return false;
      }
      if (!search.trim()) {
        return true;
      }
      const q = search.trim().toLowerCase();
      return `${item.front} ${item.back}`.toLowerCase().includes(q);
    });
  }, [words, relatedLetter, search]);

  const activeCard = filteredWords[flashIndex] ?? filteredWords[0] ?? null;
  const cardPosition = activeCard ? Math.min(flashIndex + 1, filteredWords.length) : 0;
  const visibleWords = useMemo(
    () => filteredWords.slice(0, Math.min(visibleWordsLimit, filteredWords.length)),
    [filteredWords, visibleWordsLimit]
  );

  const progressLists = useMemo(() => {
    const letterScores = letters
      .map((letter) => {
        const relatedWords = words.filter((word) => word.front.includes(letter.front));
        if (!relatedWords.length) {
          return null;
        }

        // Higher is better: rewards consistency and interval, penalizes lapses.
        const totalStrength = relatedWords.reduce((sum, word) => {
          const strength = word.reps * 2 + word.ef + Math.log2(word.interval + 1) - word.lapses * 1.7;
          return sum + strength;
        }, 0);

        const averageStrength = totalStrength / relatedWords.length;
        return { letter, averageStrength, relatedCount: relatedWords.length };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    const good = [...letterScores]
      .sort((a, b) => b.averageStrength - a.averageStrength)
      .slice(0, 24)
      .filter((item) => item.averageStrength >= 2.5);

    const weak = [...letterScores]
      .sort((a, b) => a.averageStrength - b.averageStrength)
      .slice(0, 24)
      .filter((item) => item.averageStrength < 2.5);

    return { good, weak };
  }, [words, letters]);

  const lettersById = useMemo(() => {
    const map = new Map<string, (typeof letters)[number]>();
    for (const letter of letters) {
      map.set(letter.id, letter);
    }
    return map;
  }, [letters]);

  const gojuonRows = [
    ["a", "i", "u", "e", "o"],
    ["ka", "ki", "ku", "ke", "ko"],
    ["sa", "shi", "su", "se", "so"],
    ["ta", "chi", "tsu", "te", "to"],
    ["na", "ni", "nu", "ne", "no"],
    ["ha", "hi", "fu", "he", "ho"],
    ["ma", "mi", "mu", "me", "mo"],
    ["ya", null, "yu", null, "yo"],
    ["ra", "ri", "ru", "re", "ro"],
    ["wa", null, null, null, "wo"],
    [null, null, null, null, "n"],
    ["ga", "gi", "gu", "ge", "go"],
    ["za", "ji", "zu", "ze", "zo"],
    ["da", "di", "du", "de", "do"],
    ["ba", "bi", "bu", "be", "bo"],
    ["pa", "pi", "pu", "pe", "po"],
  ] as const;

  const gojuonCells = useMemo(() => {
    return gojuonRows.flatMap((row) =>
      row.map((syllable) => {
        if (!syllable) {
          return null;
        }
        return lettersById.get(`kana_${syllable}`) ?? null;
      })
    );
  }, [lettersById]);

  const gojuonIds = useMemo(() => {
    return new Set(gojuonCells.filter(Boolean).map((letter) => letter!.id));
  }, [gojuonCells]);

  const otherLetterRows = useMemo(() => {
    const otherSyllablesInOrder = [
      "kya",
      "kyu",
      "kyo",
      "sha",
      "shu",
      "sho",
      "cha",
      "chu",
      "cho",
      "nya",
      "nyu",
      "nyo",
      "hya",
      "hyu",
      "hyo",
      "mya",
      "myu",
      "myo",
      "rya",
      "ryu",
      "ryo",
      "gya",
      "gyu",
      "gyo",
      "jya",
      "jyu",
      "jyo",
      "bya",
      "byu",
      "byo",
      "pya",
      "pyu",
      "pyo",
      "fa",
      "fi",
      "fe",
      "fo",
      "vu",
      "va",
      "vi",
      "ve",
      "vo",
      "ti",
      "tu",
      "che",
      "she",
      "je",
      "tsa",
      "tse",
      "tso",
      "dyu",
      "wi",
      "we",
      "kwa",
      "kwi",
      "kwe",
      "kwo",
      "gwa",
      "gwi",
      "gwe",
      "gwo",
      "si",
      "tsi",
      "tyu",
      "vyu",
      "vyo",
    ];

    const others = letters.filter((letter) => !gojuonIds.has(letter.id));
    const letterBySyllable = new Map<string, (typeof letters)[number]>();
    others.forEach((letter) => {
      letterBySyllable.set(letter.id.replace(/^kana_/, ""), letter);
    });

    const vowelColumns = ["a", "i", "u", "e", "o"] as const;
    const groupRows = new Map<string, Array<(typeof letters)[number] | null>>();
    const usedIds = new Set<string>();

    const splitSyllable = (syllable: string) => {
      const match = syllable.match(/^(.*?)([aiueo])$/);
      if (!match) return null;
      return { stem: match[1], vowel: match[2] as (typeof vowelColumns)[number] };
    };

    otherSyllablesInOrder.forEach((syllable) => {
      const letter = letterBySyllable.get(syllable);
      const parsed = splitSyllable(syllable);
      if (!letter || !parsed) return;

      if (!groupRows.has(parsed.stem)) {
        groupRows.set(parsed.stem, [null, null, null, null, null]);
      }

      const row = groupRows.get(parsed.stem)!;
      const columnIndex = vowelColumns.indexOf(parsed.vowel);
      row[columnIndex] = letter;
      usedIds.add(letter.id);
    });

    // Include any unexpected entries while still respecting vowel columns.
    others
      .filter((letter) => !usedIds.has(letter.id))
      .sort((a, b) => a.front.localeCompare(b.front))
      .forEach((letter) => {
        const syllable = letter.id.replace(/^kana_/, "");
        const parsed = splitSyllable(syllable);
        if (!parsed) {
          return;
        }
        if (!groupRows.has(parsed.stem)) {
          groupRows.set(parsed.stem, [null, null, null, null, null]);
        }
        const row = groupRows.get(parsed.stem)!;
        const columnIndex = vowelColumns.indexOf(parsed.vowel);
        row[columnIndex] = row[columnIndex] ?? letter;
      });

    return Array.from(groupRows.values());
  }, [letters, gojuonIds]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  };

  const orderedLetters = useMemo(() => {
    const gojuonLetters = gojuonCells.filter((letter): letter is NonNullable<(typeof gojuonCells)[number]> =>
      Boolean(letter)
    );
    const otherLettersFlat = otherLetterRows
      .flat()
      .filter((letter): letter is NonNullable<(typeof otherLetterRows)[number][number]> => Boolean(letter));
    return [...gojuonLetters, ...otherLettersFlat];
  }, [gojuonCells, otherLetterRows]);

  const openLetter = (letter: (typeof letters)[number]) => {
    setSelectedLetter(letter);
    speakJapanese(letter.front);
    showToast(`Playing ${letter.front}`);
  };

  const selectedLetterIndex = useMemo(() => {
    if (!selectedLetter) return -1;
    return orderedLetters.findIndex((letter) => letter.id === selectedLetter.id);
  }, [selectedLetter, orderedLetters]);

  const goToPreviousLetter = () => {
    if (!orderedLetters.length || selectedLetterIndex < 0) return;
    const nextIndex = (selectedLetterIndex - 1 + orderedLetters.length) % orderedLetters.length;
    openLetter(orderedLetters[nextIndex]);
  };

  const goToNextLetter = () => {
    if (!orderedLetters.length || selectedLetterIndex < 0) return;
    const nextIndex = (selectedLetterIndex + 1) % orderedLetters.length;
    openLetter(orderedLetters[nextIndex]);
  };

  const randomizeWithinFiltered = () => {
    if (!filteredWords.length) return 0;
    if (filteredWords.length === 1) return 0;

    let nextIndex = Math.floor(Math.random() * filteredWords.length);
    while (nextIndex === flashIndex) {
      nextIndex = Math.floor(Math.random() * filteredWords.length);
    }
    return nextIndex;
  };

  const navigateToCard = (nextIndex: number) => {
    if (pendingCardChangeTimer.current !== null) {
      window.clearTimeout(pendingCardChangeTimer.current);
      pendingCardChangeTimer.current = null;
    }

    if (cardFlipped) {
      toggleFlip();
      pendingCardChangeTimer.current = window.setTimeout(() => {
        setFlashIndex(nextIndex);
        pendingCardChangeTimer.current = null;
      }, 220);
      return;
    }

    setFlashIndex(nextIndex);
  };

  const goToPreviousCard = () => {
    if (!filteredWords.length) return;
    const nextIndex = randomizeWithinFiltered();
    navigateToCard(nextIndex);
  };

  const goToNextCard = () => {
    if (!filteredWords.length) return;
    const nextIndex = randomizeWithinFiltered();
    navigateToCard(nextIndex);
  };

  useEffect(() => {
    return () => {
      if (pendingCardChangeTimer.current !== null) {
        window.clearTimeout(pendingCardChangeTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (activeTab !== "words" || mode !== "flashcard") {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setMode("list");
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        toggleFlip();
      }

      if (!cardFlipped) {
        if (event.key === "ArrowLeft") {
          goToPreviousCard();
        }
        if (event.key === "ArrowRight") {
          goToNextCard();
        }
        return;
      }

      if (event.key === "1") gradeCard(1);
      if (event.key === "2") gradeCard(3);
      if (event.key === "3") gradeCard(4);
      if (event.key === "4") gradeCard(5);
      if (event.key === "ArrowLeft") goToPreviousCard();
      if (event.key === "ArrowRight") goToNextCard();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab, mode, cardFlipped, toggleFlip, gradeCard, flashIndex, filteredWords.length, setMode]);

  useEffect(() => {
    if (activeTab !== "words" || mode !== "flashcard") {
      return;
    }

    if (!cardFlipped || !activeCard) {
      return;
    }

    speakJapanese(activeCard.front);
  }, [activeTab, mode, cardFlipped, activeCard]);

  useEffect(() => {
    if (!selectedLetter) return;

    const modalKeyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedLetter(null);
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToPreviousLetter();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToNextLetter();
      }
    };

    window.addEventListener("keydown", modalKeyHandler);
    return () => window.removeEventListener("keydown", modalKeyHandler);
  }, [selectedLetter, setSelectedLetter, selectedLetterIndex, orderedLetters]);

  useEffect(() => {
    if (activeTab !== "words" || hasShownWordsHelp) {
      return;
    }

    setShowWordsHelp(true);
    setHasShownWordsHelp(true);
  }, [activeTab, hasShownWordsHelp]);

  useEffect(() => {
    setVisibleWordsLimit(INITIAL_WORDS_LIMIT);
  }, [search, relatedLetter]);

  if (!initialized) {
    return <main className="loading">Loading Katakana Master...</main>;
  }

  if (!cloudConfigured) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Katakana Master</p>
          <h1>Cloud Login Required</h1>
          <p>
            This app is configured to allow access only after login, but cloud auth is not configured yet.
          </p>
          <p>Add Supabase environment variables and restart the app.</p>
        </section>
      </main>
    );
  }

  if (!cloudConnected) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">Katakana Master</p>
          <h1>Sign In To Continue</h1>
          <p>Login with email or phone to access your learning dashboard and synced progress.</p>

          <div className="auth-tabs" role="tablist" aria-label="Login methods">
            <button
              className={loginMode === "email" ? "active" : ""}
              onClick={() => {
                setLoginMode("email");
                setAwaitingPhoneOtp(false);
                setLoginCode("");
              }}
              role="tab"
              aria-selected={loginMode === "email"}
            >
              Email
            </button>
            <button
              className={loginMode === "phone" ? "active" : ""}
              onClick={() => setLoginMode("phone")}
              role="tab"
              aria-selected={loginMode === "phone"}
            >
              Phone
            </button>
          </div>

          {loginMode === "email" && (
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                const email = loginEmail.trim();
                if (!email) {
                  showToast("Please enter your email");
                  return;
                }

                void signInCloudEmail(email)
                  .then(() => showToast("Magic link sent to your email"))
                  .catch(() => showToast("Could not send login link"));
              }}
            >
              <label htmlFor="email-login">Email</label>
              <input
                id="email-login"
                type="email"
                value={loginEmail}
                placeholder="you@example.com"
                onChange={(event) => setLoginEmail(event.target.value)}
                autoComplete="email"
                required
              />
              <button className="btn primary" type="submit">
                Send Magic Link
              </button>
            </form>
          )}

          {loginMode === "phone" && (
            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                const phone = loginPhone.trim();
                if (!phone) {
                  showToast("Please enter phone number in +country format");
                  return;
                }

                void signInCloudPhone(phone)
                  .then(() => {
                    setAwaitingPhoneOtp(true);
                    showToast("OTP sent to your phone");
                  })
                  .catch(() => showToast("Could not send phone OTP"));
              }}
            >
              <label htmlFor="phone-login">Phone Number (E.164)</label>
              <input
                id="phone-login"
                type="tel"
                value={loginPhone}
                placeholder="+14155550123"
                onChange={(event) => setLoginPhone(event.target.value)}
                autoComplete="tel"
                required
              />
              <button className="btn" type="submit">
                Send OTP
              </button>

              {awaitingPhoneOtp && (
                <>
                  <label htmlFor="phone-otp">OTP Code</label>
                  <input
                    id="phone-otp"
                    value={loginCode}
                    placeholder="123456"
                    onChange={(event) => setLoginCode(event.target.value)}
                    inputMode="numeric"
                    required
                  />
                  <button
                    className="btn primary"
                    type="button"
                    onClick={() => {
                      const phone = loginPhone.trim();
                      const code = loginCode.trim();
                      if (!phone || !code) {
                        showToast("Enter phone and OTP code");
                        return;
                      }

                      void verifyCloudPhoneOtp(phone, code)
                        .then(() => showToast("Phone verified. Signing in..."))
                        .catch(() => showToast("Invalid OTP code"));
                    }}
                  >
                    Verify OTP
                  </button>
                </>
              )}
            </form>
          )}

          {cloudMessage && <p className="auth-hint">{cloudMessage}</p>}
        </section>

        <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">
          {toast ?? ""}
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <div className="bg-orb orb-a" aria-hidden="true" />
      <div className="bg-orb orb-b" aria-hidden="true" />

      <header className="app-header">
        <div>
          <p className="eyebrow">Katakana Master</p>
          <h1>Learn Katakana with Spaced Repetition</h1>
        </div>
        <div className="header-actions">
          <span className={`cloud-pill ${cloudSyncState}`}>
            {`Cloud: ${cloudUserEmail ?? cloudUserPhone ?? "Connected"}`}
          </span>
          <button
            className="btn"
            onClick={() => {
              void syncCloudNow()
                .then(() => showToast("Cloud sync complete"))
                .catch(() => showToast("Cloud sync failed"));
            }}
          >
            Sync Now
          </button>
          <button
            className="btn"
            onClick={() => {
              void signOutCloud()
                .then(() => showToast("Signed out of cloud sync"))
                .catch(() => showToast("Could not sign out"));
            }}
          >
            Sign Out
          </button>

          <button className="btn" onClick={() => setShowHelp(true)}>
            Shortcuts
          </button>
        <button
          className={`btn primary ${dueCount > 0 ? "ready" : ""}`}
          onClick={() => {
            setTab("words");
            setMode("flashcard");
            setRelatedLetter("");
            setFlashIndex(0);
            showToast("Review mode started");
          }}
        >
          Start Review ({dueCount})
        </button>
        </div>
      </header>

      <section className="home panel">
        <div className="home-hero">
          <p className="home-kicker">Daily Focus</p>
          <h2 className="home-title">Build reading speed with short, consistent sessions</h2>
          <p className="home-subtitle">Track progress, reinforce sound, and strengthen recognition every day.</p>

          <div className="hero-metrics">
            <article className="metric-pill">
              <small>Cards due</small>
              <strong>{dueCount}</strong>
            </article>
            <article className="metric-pill">
              <small>Current streak</small>
              <strong>{streak} days</strong>
            </article>
          </div>

          <div className="hero-actions">
            <button
              className="btn"
              onClick={() => {
                setTab("letters");
                showToast("Switched to Letters");
              }}
            >
              Explore Letters
            </button>
            <button
              className="btn primary"
              onClick={() => {
                setTab("words");
                setMode("flashcard");
                setRelatedLetter("");
                setFlashIndex(0);
                showToast("Review mode started");
              }}
            >
              Start Word Review
            </button>
          </div>
        </div>

        <div className="tips">
          <article>
            <h3>Explore Letters</h3>
            <p>Tap letters and play Japanese speech.</p>
          </article>
          {activeTab === "words" ? (
            <>
              <article>
                <h3>Review Words</h3>
                <p>Flip cards and grade recall honestly.</p>
              </article>
              <article>
                <h3>Repeat Daily</h3>
                <p>Small sessions compound into retention.</p>
              </article>
            </>
          ) : (
            <>
              <article>
                <h3>Master Kana Shapes</h3>
                <p>Focus on quick visual recognition for each character.</p>
              </article>
              <article>
                <h3>Replay Audio</h3>
                <p>Use replay in the letter modal to lock in pronunciation.</p>
              </article>
            </>
          )}
        </div>
      </section>

      {cloudMessage && (
        <p className="cloud-message" role="status" aria-live="polite">
          {cloudMessage}
        </p>
      )}

      <nav className="tabs" aria-label="Learning modes">
        <button className={activeTab === "letters" ? "active" : ""} onClick={() => setTab("letters")}>
          Letters
        </button>
        <button className={activeTab === "words" ? "active" : ""} onClick={() => setTab("words")}>
          Words
        </button>
        <button className={activeTab === "progress" ? "active" : ""} onClick={() => setTab("progress")}>
          Progress
        </button>
      </nav>

      {activeTab === "letters" && (
        <section className="panel">
          <div className="letters-grid">
            {gojuonCells.map((letter, index) => {
              if (!letter) {
                return <div key={`empty-${index}`} className="letter-empty" aria-hidden="true" />;
              }

              return (
                <button
                  key={letter.id}
                  className="letter-tile"
                  onClick={() => openLetter(letter)}
                >
                  <span className={`dot ${letter.reps >= 5 ? "done" : ""}`} />
                  <span className="char">{letter.front}</span>
                </button>
              );
            })}
          </div>

          {otherLetterRows.length > 0 && (
            <>
              <h3 className="other-letters-title">Other Katakana</h3>
              <div className="letters-grid other-letters-grid">
                {otherLetterRows.flatMap((row, rowIndex) =>
                  row.map((letter, colIndex) => {
                    if (!letter) {
                      return (
                        <div key={`other-empty-${rowIndex}-${colIndex}`} className="letter-empty" aria-hidden="true" />
                      );
                    }

                    return (
                      <button
                        key={letter.id}
                        className="letter-tile"
                        onClick={() => openLetter(letter)}
                      >
                        <span className={`dot ${letter.reps >= 5 ? "done" : ""}`} />
                        <span className="char">{letter.front}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </section>
      )}

      {activeTab === "words" && (
        <section className="panel words-panel">
          <div className="controls">
            <input
              value={search}
              placeholder="Search katakana or meaning"
              aria-label="Search words"
              onChange={(e) => {
                setSearch(e.target.value);
                setFlashIndex(0);
              }}
            />
            <button className="btn" onClick={() => setMode(mode === "list" ? "flashcard" : "list")}>
              {mode === "list" ? "Flashcard Mode" : "List Mode"}
            </button>
            <button className="btn" onClick={() => setShowWordsHelp(true)}>
              Review Tips
            </button>
            {search && (
              <button
                className="btn"
                onClick={() => {
                  setSearch("");
                  setFlashIndex(0);
                }}
              >
                Clear
              </button>
            )}
          </div>

          <div className="words-meta" aria-live="polite">
            <span>{filteredWords.length} results</span>
            {relatedLetter && (
              <button
                className="chip"
                onClick={() => {
                  setRelatedLetter("");
                  setFlashIndex(0);
                }}
              >
                Filter: {relatedLetter} x
              </button>
            )}
          </div>

          {mode === "list" && (
            <div className="words-list">
              {filteredWords.length === 0 && (
                <p className="empty">
                  No words matched. Try another search or clear the active filter.
                </p>
              )}
              {visibleWords.map((word) => (
                <button
                  key={word.id}
                  className="word-row"
                  onClick={() => {
                    setMode("flashcard");
                    setFlashIndex(filteredWords.findIndex((w) => w.id === word.id));
                    showToast("Switched to flashcard mode");
                  }}
                >
                  <span>{word.front}</span>
                  <span>{word.back}</span>
                </button>
              ))}
              {filteredWords.length > visibleWords.length && (
                <button
                  className="btn load-more-btn"
                  onClick={() => setVisibleWordsLimit((current) => current + WORDS_LOAD_STEP)}
                >
                  Load more ({filteredWords.length - visibleWords.length} remaining)
                </button>
              )}
            </div>
          )}

          {mode === "flashcard" && (
            <div className="overlay" onClick={() => setMode("list")}>
              <dialog open className="letter-modal flashcard-modal" onClick={(e) => e.stopPropagation()}>
                <div className="flash-topbar">
                  <p className="card-counter">
                    Card {cardPosition} of {filteredWords.length || 0}
                  </p>
                </div>

                <div className="flashcard-wrap">
                  <button
                    className="card-arrow card-arrow-left"
                    onClick={goToPreviousCard}
                    disabled={!activeCard}
                    aria-label="Previous card"
                  >
                    {"<"}
                  </button>

                  <button
                    className={`flashcard ${cardFlipped ? "flipped" : ""}`}
                    onClick={() => toggleFlip()}
                    aria-label="Flip flashcard"
                  >
                    <div className="face front">{activeCard ? activeCard.front : "No cards"}</div>
                    <div className="face back">
                      <p>{activeCard ? activeCard.back : "Adjust filters"}</p>
                      {activeCard && (
                        <button
                          className="btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            speakJapanese(activeCard.front);
                          }}
                          aria-label="Play Japanese pronunciation"
                        >
                          Play Audio
                        </button>
                      )}
                    </div>
                  </button>

                  <button
                    className="card-arrow card-arrow-right"
                    onClick={goToNextCard}
                    disabled={!activeCard}
                    aria-label="Next card"
                  >
                    {">"}
                  </button>
                </div>

                <div className={`grading ${cardFlipped ? "show" : ""}`}>
                  <button
                    className="again"
                    onClick={() => {
                      void gradeCard(1);
                      showToast("Saved: Again");
                    }}
                    disabled={!activeCard}
                  >
                    Again (1)
                  </button>
                  <button
                    className="hard"
                    onClick={() => {
                      void gradeCard(3);
                      showToast("Saved: Hard");
                    }}
                    disabled={!activeCard}
                  >
                    Hard (2)
                  </button>
                  <button
                    className="good"
                    onClick={() => {
                      void gradeCard(4);
                      showToast("Saved: Good");
                    }}
                    disabled={!activeCard}
                  >
                    Good (3)
                  </button>
                  <button
                    className="easy"
                    onClick={() => {
                      void gradeCard(5);
                      showToast("Saved: Easy");
                    }}
                    disabled={!activeCard}
                  >
                    Easy (4)
                  </button>
                </div>
                <p className="shortcut-hint">Keyboard: Space flip, 1-4 grade, Left/Right switch cards, Esc close modal.</p>
                <button className="btn modal-close" onClick={() => setMode("list")}>
                  Close
                </button>
              </dialog>
            </div>
          )}
        </section>
      )}

      {activeTab === "progress" && (
        <section className="panel progress-panel">
          <div className="progress-head">
            <h2>Letter Recognition Overview</h2>
            <p>Letters are ranked by your performance on words containing each letter.</p>
          </div>

          <div className="progress-columns">
            <article>
              <h3>Good At</h3>
              <div className="progress-list">
                {progressLists.good.length === 0 && <p className="empty">No strong letters yet. Keep reviewing.</p>}
                {progressLists.good.map(({ letter, relatedCount }) => (
                  <div key={`good-${letter.id}`} className="progress-row strong">
                    <span>{letter.front}</span>
                    <small>{letter.back} | {relatedCount} words</small>
                  </div>
                ))}
              </div>
            </article>

            <article>
              <h3>Needs Work</h3>
              <div className="progress-list">
                {progressLists.weak.length === 0 && <p className="empty">Great work. No weak letters detected.</p>}
                {progressLists.weak.map(({ letter, relatedCount }) => (
                  <div key={`weak-${letter.id}`} className="progress-row weak">
                    <span>{letter.front}</span>
                    <small>{letter.back} | {relatedCount} words</small>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      )}

      {selectedLetter && (
        <div className="overlay" onClick={() => setSelectedLetter(null)}>
          <dialog open className="letter-modal" onClick={(e) => e.stopPropagation()}>
            <p className="kana">{selectedLetter.front}</p>
            <p className="reading">{selectedLetter.back}</p>
            <p>Next review: {formatNextReview(selectedLetter.nextDate)}</p>
            <div className="letter-nav">
              <button className="btn letter-nav-arrow" onClick={goToPreviousLetter} aria-label="Previous letter">
                {"<"}
              </button>
              <button className="btn letter-nav-arrow" onClick={goToNextLetter} aria-label="Next letter">
                {">"}
              </button>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => speakJapanese(selectedLetter.front)}>
                Replay
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  setRelatedLetter(selectedLetter.front);
                  setTab("words");
                  setMode("flashcard");
                  setFlashIndex(0);
                  setSelectedLetter(null);
                  showToast(`Filter enabled: ${selectedLetter.front}`);
                }}
              >
                Practice words with this letter
              </button>
            </div>
            <button className="btn modal-close" onClick={() => setSelectedLetter(null)}>
              Close
            </button>
          </dialog>
        </div>
      )}

      {showHelp && (
        <div className="overlay" onClick={() => setShowHelp(false)}>
          <dialog open className="letter-modal help-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Keyboard Shortcuts</h3>
            <p>Space: Flip flashcard</p>
            <p>1/2/3/4: Again, Hard, Good, Easy</p>
            <p>Left/Right: Random previous or next card</p>
            <p>Esc: Close active popup</p>
            <button className="btn modal-close" onClick={() => setShowHelp(false)}>
              Close
            </button>
          </dialog>
        </div>
      )}

      {showWordsHelp && (
        <div className="overlay" onClick={() => setShowWordsHelp(false)}>
          <dialog open className="letter-modal help-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Words Mode Tips</h3>
            <p>Tap the card to flip between katakana and meaning.</p>
            <p>Use left/right arrows on the card sides to move quickly.</p>
            <p>Use 1/2/3/4 keys to grade Again/Hard/Good/Easy.</p>
            <p>Use the filter chip to return to full word list.</p>
            <button className="btn modal-close" onClick={() => setShowWordsHelp(false)}>
              Close
            </button>
          </dialog>
        </div>
      )}

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">
        {toast ?? ""}
      </div>
    </div>
  );
}
