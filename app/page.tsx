"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import Link from "next/link";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine 
} from 'recharts';
import { generateStoryReport } from "@/lib/pdf-export";



type CharacterEntry = {
  name: string;
  mentions: number;
  role: string;
};

type AnalyzeResult = {
  overallScore: number;
  grammar: number;
  plot: number;
  characters: number;
  pacing: number;
  originality: number;
  emotionalImpact: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  // Extended fields
  summary?: string;
  themes?: string[];
  characterList?: CharacterEntry[];
  timeline?: string[];
    readability?: {
      flesch_reading_ease: number;
      grade_level: number;
      word_count: number;
      sentence_count: number;
      average_sentence_length: number;
    };
    sentiment?: { section: number | string; score: number }[];
    relationshipGraph?: {
      nodes: { id: string; type: string }[];
      links: { source: string; target: string; type: string }[];
    };
    analysisMode?: "quick" | "deep";
} | null;

export default function Home() {
  const MIN_STORY_LENGTH = 100;
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<"quick" | "deep">("deep");
  const [isExporting, setIsExporting] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    }).catch(() => {
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfError(null);
    if (file.type !== "application/pdf") {
      setPdfError("Please upload a valid PDF file.");
      return;
    }

    setIsPdfLoading(true);

    try {
      // Dynamically import pdfjs-dist only on the client side when needed
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let extractedText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // Extract text items from the page content
        const pageText = content.items
          .filter((item) => "str" in item)
          .map((item) => (item as { str: string }).str)
          .join(" ");
        extractedText += pageText + "\n\n";
      }

      setStory(extractedText.trim());
      setPdfError(null);
    } catch (error) {
      console.error("Failed to parse PDF:", error);
      setPdfError("Failed to extract text. Please ensure it's a valid PDF or paste the text manually.");
    } finally {
      setIsPdfLoading(false);
      // Reset the input so the same file can be uploaded again if needed
      e.target.value = "";
    }
  };

  const handleAnalyze = async (mode: "quick" | "deep" = "deep") => {
    if (story.length < MIN_STORY_LENGTH) return;

    setLoading(true);
    setAnalysisMode(mode);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ story, analysisMode: mode }),
      });

      const analysisData = await response.json();

      if (analysisData.error) {
        setAnalysisError(analysisData.details ? `${analysisData.error}: ${analysisData.details}` : analysisData.error);
        setLoading(false);
        return;
      }

      setAnalysisError(null);
      setResult(analysisData);

      // --- Save to Supabase ---
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (session?.user) {
        console.log("Saving analysis for user:", session.user.id);
        const { error: saveError } = await supabase
          .from("analyses")
          .insert({
            user_id: session.user.id,
            story: story,
            result: analysisData,
          });

        if (saveError) {
          console.error("Failed to save analysis:", saveError.message, saveError);
        } else {
          console.log("Analysis saved successfully.");
        }
      } else {
        console.log("User not logged in — skipping save.");
      }
      // --- End Save ---

    } catch (error: any) {
      console.error("Analysis failed:", error);
      setAnalysisError(error.message || "An unexpected error occurred during analysis.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;

    const text = `
Story Analysis Results
======================
Overall Score: ${result.overallScore}/10

Scores:
- Grammar: ${result.grammar}/10
- Plot: ${result.plot}/10
- Characters: ${result.characters}/10
- Pacing: ${result.pacing}/10
- Originality: ${result.originality}/10
- Emotional Impact: ${result.emotionalImpact}/10

Summary:
${result.summary || "N/A"}

Themes:
${result.themes?.join(", ") || "N/A"}

Characters:
${result.characterList?.map(c => `- ${c.name} (${c.role}, ${c.mentions} mentions)`).join('\n') || "N/A"}

Timeline:
${result.timeline?.map((e, i) => `${i + 1}. ${e}`).join('\n') || "N/A"}

Readability:
- Flesch Reading Ease: ${result.readability?.flesch_reading_ease || "N/A"}
- Grade Level: ${result.readability?.grade_level || "N/A"}
- Word Count: ${result.readability?.word_count || "N/A"}
- Sentence Count: ${result.readability?.sentence_count || "N/A"}
- Average Sentence Length: ${result.readability?.average_sentence_length || "N/A"}

Strengths:
${result.strengths.map(s => `- ${s}`).join('\n')}

Areas for Improvement:
${result.weaknesses.map(w => `- ${w}`).join('\n')}

Suggestions:
${result.suggestions.map(s => `- ${s}`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(text).then(() => {
      alert("Results copied to clipboard!");
    }).catch(err => {
      console.error("Failed to copy!", err);
    });
  };

  const handleDownloadPdf = async () => {
    if (!result) return;
    setIsExporting(true);
    try {
      await generateStoryReport(story, result);
    } catch (err) {
      console.error("PDF Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-200 via-gray-100 to-indigo-100 text-slate-800 flex flex-col items-center justify-center p-4 sm:p-8 md:p-12 overflow-hidden">
      {/* Decorative Background Circles */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>

      {/* Top Navigation Bar */}
      <nav className="absolute top-0 left-0 right-0 p-5 sm:p-6 w-full flex justify-end items-center z-50">
        {!authLoading && (
          user ? (
            <div className="flex items-center space-x-6">
              <Link
                href="/compare"
                className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors hidden sm:block"
              >
                Compare Stories
              </Link>
              <Link
                href="/dashboard"
                title="Go to Profile"
                className="group relative flex items-center justify-center w-12 h-12 rounded-full transition-transform duration-300 hover:scale-105 active:scale-95"
              >
                <span className="absolute inset-0 rounded-full bg-white/30 backdrop-blur-xl border border-white/60 shadow-[0_4px_24px_0_rgba(99,102,241,0.18),inset_0_1.5px_2px_0_rgba(255,255,255,0.7)] group-hover:shadow-[0_6px_32px_0_rgba(99,102,241,0.30),inset_0_1.5px_2px_0_rgba(255,255,255,0.8)] transition-shadow duration-300 pointer-events-none" />
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt="Profile"
                    className="relative w-10 h-10 rounded-full object-cover border-2 border-white/70 shadow-sm"
                  />
                ) : (
                  <span className="relative w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-sm border-2 border-white/70">
                    {(user.user_metadata?.full_name?.[0] || user.email?.[0] || "?").toUpperCase()}
                  </span>
                )}
              </Link>
            </div>


          ) : (
            /* Logged out — liquid glass Google Sign In button */
            <div className="flex items-center space-x-6">
              <Link
                href="/compare"
                className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors hidden sm:block"
              >
                Compare Stories
              </Link>
              <button
                onClick={handleGoogleLogin}
                className="group relative flex items-center space-x-2.5 px-5 py-2.5 rounded-full transition-transform duration-300 hover:scale-105 active:scale-95"
              >
              <span className="absolute inset-0 rounded-full bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_4px_24px_0_rgba(99,102,241,0.15),inset_0_1.5px_2px_0_rgba(255,255,255,0.7)] group-hover:shadow-[0_6px_32px_0_rgba(99,102,241,0.25),inset_0_1.5px_2px_0_rgba(255,255,255,0.8)] transition-shadow duration-300 pointer-events-none" />
              <svg className="relative w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.01 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="relative text-sm font-semibold text-slate-700">Sign in with Google</span>
            </button>
            </div>
          )
        )}
      </nav>

      <div className="max-w-6xl w-full flex flex-col items-center space-y-12 my-auto relative z-10 mt-16 sm:mt-0">

        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col md:flex-row items-center justify-between w-full gap-8 md:gap-12"
        >
          <div className="text-center md:text-left space-y-4 flex-1">
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 pb-2 font-playfair">
              Story Analyzer
            </h1>
            <p className="text-lg sm:text-2xl text-slate-600 font-medium max-w-2xl mx-auto md:mx-0">
              Get brutally honest AI feedback on your stories.
            </p>
          </div>
          <div className="flex-1 w-full flex justify-center md:justify-end">
            <div className="relative w-full max-w-[400px] md:max-w-[500px] aspect-square animate-float">
              <Image
                src="/hero-illustration.svg"
                alt="Story Analyzer Hero Illustration"
                fill
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>
          </div>
        </motion.div>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="w-full flex flex-col space-y-6 max-w-4xl mx-auto"
        >
          {/* PDF Upload */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white/80 backdrop-blur-md border border-white/50 p-6 rounded-3xl shadow-xl transition-all duration-300 hover:shadow-2xl">
            <div className="flex flex-col mb-4 sm:mb-0">
              <span className="text-lg font-bold text-slate-800 flex items-center">
                <svg className="w-6 h-6 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                Upload PDF
              </span>
              <span className="text-sm text-slate-500 mt-1">Extract text from your document automatically.</span>
            </div>
            <label className={`relative cursor-pointer bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 text-sm py-3 px-6 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center justify-center font-semibold ${isPdfLoading ? 'opacity-75 cursor-wait' : ''}`}>
              {isPdfLoading ? (
                <>
                  <svg className="w-5 h-5 mr-2 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                  Select File
                </>
              )}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileUpload}
                disabled={isPdfLoading}
              />
            </label>
          </div>

          {pdfError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="w-full bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center space-x-3 text-rose-600 shadow-sm"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <span className="text-sm font-bold">{pdfError}</span>
            </motion.div>
          )}

          <div className="w-full relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 rounded-3xl blur opacity-40 group-hover:opacity-60 transition duration-500"></div>
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              disabled={loading}
              className="relative w-full h-72 sm:h-96 p-8 bg-white/90 backdrop-blur-md border border-white/50 rounded-3xl shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none text-slate-800 placeholder-slate-400 text-lg transition-colors leading-relaxed disabled:opacity-70 disabled:cursor-not-allowed font-merriweather"
              placeholder="Paste your story here..."
            ></textarea>
            <div className="absolute bottom-6 right-8 flex items-center space-x-2">
              <div className={`text-xs font-bold px-3 py-1 rounded-full backdrop-blur-md border ${story.length >= MIN_STORY_LENGTH
                  ? 'bg-emerald-100/80 text-emerald-600 border-emerald-200'
                  : 'bg-amber-100/80 text-amber-600 border-amber-200'
                }`}>
                {story.length} / {MIN_STORY_LENGTH} characters
              </div>
            </div>
          </div>

          {story.length > 0 && story.length < MIN_STORY_LENGTH && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-amber-600 text-sm font-semibold text-center bg-amber-50/50 py-2 rounded-xl border border-amber-100"
            >
              Stories must be at least {MIN_STORY_LENGTH} characters long to be analyzed.
            </motion.p>
          )}

          {analysisError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full bg-rose-50 border border-rose-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-rose-600 shadow-sm"
            >
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span className="text-sm font-bold">{analysisError}</span>
              </div>
              <button
                onClick={() => handleAnalyze(analysisMode)}
                className="whitespace-nowrap px-4 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-xs font-black transition-colors flex items-center"
              >
                <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                Retry
              </button>
            </motion.div>
          )}

        </motion.div>


        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center w-full max-w-2xl mx-auto">
          <motion.button
            onClick={() => handleAnalyze("quick")}
            disabled={loading || story.length < MIN_STORY_LENGTH}
            whileHover={{ scale: (loading || story.length < MIN_STORY_LENGTH) ? 1 : 1.05 }}
            whileTap={{ scale: (loading || story.length < MIN_STORY_LENGTH) ? 1 : 0.95 }}
            className="flex-1 w-full relative h-16 inline-flex items-center justify-center rounded-2xl bg-white border-2 border-indigo-100 px-8 py-4 text-lg font-bold text-indigo-600 shadow-lg hover:border-indigo-400 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {loading && analysisMode === "quick" ? (
              <span className="flex items-center">
                Running Quick Analysis...
                <svg className="ml-2 w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-xl group-hover:animate-bounce">⚡</span>
                Quick Analysis
              </span>
            )}
          </motion.button>

          <motion.button
            onClick={() => handleAnalyze("deep")}
            disabled={loading || story.length < MIN_STORY_LENGTH}
            whileHover={{ scale: (loading || story.length < MIN_STORY_LENGTH) ? 1 : 1.05 }}
            whileTap={{ scale: (loading || story.length < MIN_STORY_LENGTH) ? 1 : 0.95 }}
            className="flex-1 w-full relative h-16 inline-flex items-center justify-center rounded-2xl bg-indigo-600 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 hover:shadow-indigo-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {loading && analysisMode === "deep" ? (
              <span className="flex items-center">
                Running Deep Analysis...
                <svg className="ml-2 w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-xl group-hover:animate-pulse">🧠</span>
                Deep Analysis
              </span>
            )}
          </motion.button>
        </div>

        {/* Result Section */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex flex-col items-center justify-center space-y-4 py-20"
          >
            <div className="relative">
              <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-indigo-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
            </div>
            <p className="text-xl font-bold text-slate-600 animate-pulse">Brewing your analysis...</p>
          </motion.div>
        )}

        {result && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="w-full space-y-10 pt-8"
          >
            {/* Fun Message Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="w-full max-w-2xl mx-auto bg-white/70 backdrop-blur-md border border-white/50 rounded-2xl p-5 text-center shadow-lg"
            >
              <p className="text-lg font-semibold italic text-slate-700 font-playfair">
                {result.overallScore < 4
                  ? "This manuscript may require divine intervention."
                  : result.overallScore > 9
                    ? "Either you're a literary genius, or the AI is starstruck."
                    : "Every great story starts with a rough draft."}
              </p>
            </motion.div>

            {/* Action Bar */}
            <div className="flex justify-end w-full space-x-4">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                disabled={isExporting}
                onClick={handleDownloadPdf}
                className="inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors disabled:opacity-50"
              >
                {isExporting ? (
                  <svg className="w-5 h-5 mr-2 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                )}
                {isExporting ? "Generating..." : "Download PDF"}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCopy}
                className="inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                Copy Results
              </motion.button>
            </div>

            {/* Top Cards: Overall Score & Sub-scores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Overall Score Card */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="col-span-1 sm:col-span-2 lg:col-span-3 bg-white/80 backdrop-blur-md border border-white/50 rounded-3xl p-8 sm:p-10 shadow-xl flex flex-col items-center justify-center hover:shadow-2xl transition-shadow"
              >
                <span className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-3 text-center">Overall Score</span>
                <span className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 font-space-grotesk">
                  {result.overallScore}
                </span>
                <span className="text-slate-400 text-base mt-2 font-bold font-space-grotesk">/ 10</span>
              </motion.div>

              {/* Sub-scores Grid */}
              {[
                { label: "Grammar", score: result.grammar, color: "text-indigo-600", bg: "bg-indigo-50" },
                { label: "Plot", score: result.plot, color: "text-purple-600", bg: "bg-purple-50" },
                { label: "Characters", score: result.characters, color: "text-pink-600", bg: "bg-pink-50" },
                { label: "Pacing", score: result.pacing, color: "text-amber-600", bg: "bg-amber-50" },
                { label: "Originality", score: result.originality, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "Emotion", score: result.emotionalImpact, color: "text-rose-600", bg: "bg-rose-50" }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ scale: 1.05, y: -2 }}
                  className={`bg-white/90 backdrop-blur-sm border border-slate-100 rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg hover:shadow-xl transition-shadow h-full ${item.bg}`}
                >
                  <span className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2 text-center leading-tight">{item.label}</span>
                  <span className={`text-3xl sm:text-4xl font-bold ${item.color} font-space-grotesk`}>{item.score}</span>
                </motion.div>
              ))}
            </div>

            {/* Detailed Feedback Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Strengths */}
              <motion.div
                whileHover={{ y: -2 }}
                className="h-full bg-white/80 backdrop-blur-md border border-emerald-100 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-shadow hover:border-emerald-200"
              >
                <h3 className="text-2xl font-black text-emerald-600 flex items-center mb-6">
                  <div className="bg-emerald-100 p-2 rounded-xl mr-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  Strengths
                </h3>
                <ul className="space-y-4">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="bg-slate-50/80 rounded-2xl p-5 text-slate-700 flex items-start border border-slate-100 shadow-sm">
                      <span className="text-emerald-500 mr-3 mt-1 text-xl leading-none">•</span>
                      <span className="leading-relaxed font-medium">{s}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* Weaknesses */}
              <motion.div
                whileHover={{ y: -2 }}
                className="h-full bg-white/80 backdrop-blur-md border border-rose-100 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-shadow hover:border-rose-200"
              >
                <h3 className="text-2xl font-bold text-rose-600 flex items-center mb-6">
                  <div className="bg-rose-100 p-2 rounded-xl mr-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  </div>
                  Improvement
                </h3>
                <ul className="space-y-4">
                  {result.weaknesses.map((w, i) => (
                    <li key={i} className="bg-slate-50/80 rounded-2xl p-5 text-slate-700 flex items-start border border-slate-100 shadow-sm">
                      <span className="text-rose-500 mr-3 mt-1 text-xl leading-none">•</span>
                      <span className="leading-relaxed font-medium">{w}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>

              {/* Suggestions */}
              <motion.div
                whileHover={{ y: -2 }}
                className="h-full bg-white/80 backdrop-blur-md border border-indigo-100 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-shadow hover:border-indigo-200"
              >
                <h3 className="text-2xl font-bold text-indigo-600 flex items-center mb-6">
                  <div className="bg-indigo-100 p-2 rounded-xl mr-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                  </div>
                  Suggestions
                </h3>
                <ul className="space-y-4">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="bg-slate-50/80 rounded-2xl p-5 text-slate-700 flex items-start border border-slate-100 shadow-sm">
                      <span className="text-indigo-500 mr-3 mt-1 text-xl leading-none">•</span>
                      <span className="leading-relaxed font-medium">{s}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* ── Extended Analysis Sections ── */}

            {/* Summary */}
            {result.summary && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white/80 backdrop-blur-md border border-slate-100 rounded-3xl p-8 shadow-xl"
              >
                <h3 className="text-xl font-bold text-slate-800 flex items-center mb-4">
                  <div className="bg-slate-100 p-2 rounded-xl mr-3">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  </div>
                  Summary
                </h3>
                <p className="text-slate-600 leading-relaxed text-base font-medium italic font-playfair">&ldquo;{result.summary}&rdquo;</p>
              </motion.div>
            )}

            {/* Themes + Characters side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* Themes */}
              {result.themes && result.themes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="bg-white/80 backdrop-blur-md border border-purple-100 rounded-3xl p-8 shadow-xl"
                >
                  <h3 className="text-xl font-bold text-purple-700 flex items-center mb-5">
                    <div className="bg-purple-100 p-2 rounded-xl mr-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                    </div>
                    Themes
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {result.themes.map((theme, i) => (
                      <span key={i} className="bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 font-bold text-sm px-4 py-2 rounded-full border border-purple-200 shadow-sm font-inter">
                        {theme}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Characters */}
              {result.characterList && result.characterList.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-white/80 backdrop-blur-md border border-pink-100 rounded-3xl p-8 shadow-xl"
                >
                  <h3 className="text-xl font-bold text-pink-700 flex items-center mb-5">
                    <div className="bg-pink-100 p-2 rounded-xl mr-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    </div>
                    Characters
                  </h3>
                  <div className="flex flex-col gap-3">
                    {result.characterList.map((char, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50/80 rounded-2xl px-4 py-3 border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-200 to-purple-200 flex items-center justify-center text-purple-700 font-bold text-sm">
                            {char.name[0]?.toUpperCase()}
                          </div>
                          <span className="font-bold text-slate-700">{char.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-3 py-1 rounded-full capitalize ${
                            char.role === "protagonist" ? "bg-emerald-100 text-emerald-700"
                            : char.role === "antagonist" ? "bg-rose-100 text-rose-700"
                            : char.role === "supporting" ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-500"
                          }`}>{char.role}</span>

                          <span className="text-xs text-slate-400 font-bold font-space-grotesk">{char.mentions}×</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Timeline */}
            {result.timeline && result.timeline.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="bg-white/80 backdrop-blur-md border border-amber-100 rounded-3xl p-8 shadow-xl"
              >
                <h3 className="text-xl font-bold text-amber-700 flex items-center mb-6 font-inter">
                  <div className="bg-amber-100 p-2 rounded-xl mr-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                  </div>
                  Story Timeline
                </h3>
                <div className="relative pl-6">
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-amber-300 to-transparent rounded-full"></div>
                  <div className="flex flex-col gap-5">
                    {result.timeline.map((event, i) => (
                      <div key={i} className="relative flex items-start gap-4">
                        <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow-sm flex items-center justify-center">
                          <span className="text-white font-bold font-space-grotesk" style={{ fontSize: "8px" }}>{i + 1}</span>
                        </div>
                        <p className="text-slate-700 font-medium leading-relaxed bg-amber-50/60 rounded-2xl px-4 py-3 border border-amber-100 flex-1">{event}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Readability */}
            {result.readability && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white/80 backdrop-blur-md border border-teal-100 rounded-3xl p-8 shadow-xl"
              >
                <h3 className="text-xl font-bold text-teal-700 flex items-center mb-6 font-inter">
                  <div className="bg-teal-100 p-2 rounded-xl mr-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                  </div>
                  Readability Metrics
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {[
                    { 
                      label: "Flesch Ease", 
                      value: result.readability.flesch_reading_ease, 
                      suffix: "/100", 
                      hint: result.readability.flesch_reading_ease >= 90 ? "Very Easy" 
                          : result.readability.flesch_reading_ease >= 80 ? "Easy"
                          : result.readability.flesch_reading_ease >= 70 ? "Fairly Easy"
                          : result.readability.flesch_reading_ease >= 60 ? "Standard"
                          : result.readability.flesch_reading_ease >= 50 ? "Fairly Difficult"
                          : result.readability.flesch_reading_ease >= 30 ? "Difficult"
                          : "Very Difficult"
                    },
                    { label: "Grade Level", value: result.readability.grade_level, suffix: "", hint: `Grade ${result.readability.grade_level}` },
                    { label: "Word Count", value: result.readability.word_count, suffix: "", hint: "Total Words" },
                    { label: "Sentences", value: result.readability.sentence_count, suffix: "", hint: "Total Sentences" },
                    { label: "Avg Sentence", value: result.readability.average_sentence_length.toFixed(1), suffix: "", hint: "Words/Sentence" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-teal-50/70 rounded-2xl p-5 flex flex-col items-center text-center border border-teal-100 h-full">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 font-inter">{stat.label}</span>
                      <span className="text-2xl font-bold text-teal-700 font-space-grotesk">{stat.value}<span className="text-sm font-bold text-teal-400 font-space-grotesk">{stat.suffix}</span></span>
                      <span className="text-[10px] text-teal-500 font-bold mt-1 leading-tight font-inter">{stat.hint}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Sentiment Analysis Chart */}
            {result.sentiment && result.sentiment.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="bg-white/80 backdrop-blur-md border border-indigo-100 rounded-3xl p-8 shadow-xl"
              >
                <h3 className="text-xl font-bold text-indigo-700 flex items-center mb-6 font-inter">
                  <div className="bg-indigo-100 p-2 rounded-xl mr-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
                  </div>
                  Emotional Journey
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.sentiment}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="section" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                        dy={10}
                        label={{ value: 'Story Sections (1-8)', position: 'insideBottom', offset: -5, fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                      />
                      <YAxis 
                        domain={[-1, 1]} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' 
                        }}
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} />
                      <Line 
                        type="monotone" 
                        dataKey="score" 
                        stroke="url(#colorScore)" 
                        strokeWidth={4} 
                        dot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                        activeDot={{ r: 8, strokeWidth: 0 }}
                      />
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#a855f7" />
                        </linearGradient>
                      </defs>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-between mt-4 px-2">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Negative</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Neutral</span>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Positive</span>
                </div>
              </motion.div>
            )}

            {/* Relationship Graph */}
            {result.relationshipGraph && result.relationshipGraph.nodes.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white/80 backdrop-blur-md border border-pink-100 rounded-3xl p-8 shadow-xl"
              >
                <h3 className="text-xl font-black text-pink-700 flex items-center mb-6">
                  <div className="bg-pink-100 p-2 rounded-xl mr-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                  </div>
                  Character Relationship Network
                </h3>
                <div className="relative h-80 w-full bg-slate-50/50 rounded-2xl overflow-hidden border border-slate-100">
                  <svg width="100%" height="100%" viewBox="0 0 800 400">
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#cbd5e1" />
                      </marker>
                    </defs>
                    {/* Render Links */}
                    {result.relationshipGraph.links.map((link, i) => {
                      const sourceNode = result.relationshipGraph!.nodes.find(n => n.id === link.source);
                      const targetNode = result.relationshipGraph!.nodes.find(n => n.id === link.target);
                      if (!sourceNode || !targetNode) return null;
                      
                      // Simple force-ish layout positions (circular)
                      const getPos = (id: string) => {
                        const idx = result.relationshipGraph!.nodes.findIndex(n => n.id === id);
                        const angle = (idx / result.relationshipGraph!.nodes.length) * 2 * Math.PI;
                        const r = 130;
                        return { x: 400 + r * Math.cos(angle), y: 200 + r * Math.sin(angle) };
                      };
                      
                      const sPos = getPos(link.source);
                      const tPos = getPos(link.target);
                      
                      return (
                        <g key={i}>
                          <line 
                            x1={sPos.x} y1={sPos.y} 
                            x2={tPos.x} y2={tPos.y} 
                            stroke="#cbd5e1" 
                            strokeWidth={2} 
                            strokeDasharray="5,5"
                          />
                          <text 
                            x={(sPos.x + tPos.x) / 2} 
                            y={(sPos.y + tPos.y) / 2 - 5} 
                            textAnchor="middle" 
                            className="text-[8px] font-black fill-slate-400 uppercase"
                          >
                            {link.type}
                          </text>
                        </g>
                      );
                    })}
                    {/* Render Nodes */}
                    {result.relationshipGraph.nodes.map((node, i) => {
                      const idx = result.relationshipGraph!.nodes.findIndex(n => n.id === node.id);
                      const angle = (idx / result.relationshipGraph!.nodes.length) * 2 * Math.PI;
                      const r = 130;
                      const x = 400 + r * Math.cos(angle);
                      const y = 200 + r * Math.sin(angle);
                      
                      return (
                        <motion.g 
                          key={node.id}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.5 + i * 0.1, type: "spring" }}
                        >
                          <circle 
                            cx={x} cy={y} r={35} 
                            className={`fill-white stroke-2 ${
                              node.type === 'protagonist' ? 'stroke-indigo-400' 
                              : node.type === 'antagonist' ? 'stroke-rose-400' 
                              : 'stroke-amber-400'
                            } shadow-sm`} 
                          />
                          <text 
                            x={x} y={y + 5} 
                            textAnchor="middle" 
                            className="text-[10px] font-bold fill-slate-700"
                          >
                            {node.id.split(' ')[0]}
                          </text>
                        </motion.g>
                      );
                    })}
                  </svg>
                  <div className="absolute bottom-4 left-4 flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Protagonist</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Antagonist</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </motion.div>
        )}

      </div>
    </main>
  );
}