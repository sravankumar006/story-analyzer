"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

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
} | null;

export default function Home() {
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please upload a valid PDF file.");
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
        const pageText = content.items.map((item: any) => item.str).join(" ");
        extractedText += pageText + "\n\n";
      }

      setStory(extractedText.trim());
    } catch (error) {
      console.error("Failed to parse PDF:", error);
      alert("Failed to parse the PDF file. Please try another one.");
    } finally {
      setIsPdfLoading(false);
      // Reset the input so the same file can be uploaded again if needed
      e.target.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (!story.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ story }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
    } catch (error) {
      console.error("Analysis failed:", error);
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

    // Dynamically import jsPDF to keep bundle size small and avoid SSR issues
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Story Analysis Report", pageWidth / 2, y, { align: "center" });
    y += 15;

    // Overall Score
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Overall Score: ${result.overallScore}/10`, margin, y);
    y += 10;

    // Sub-scores
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const scores = [
      `Grammar: ${result.grammar}/10`,
      `Plot: ${result.plot}/10`,
      `Characters: ${result.characters}/10`,
      `Pacing: ${result.pacing}/10`,
      `Originality: ${result.originality}/10`,
      `Emotional Impact: ${result.emotionalImpact}/10`
    ];

    // Print scores in 2 columns
    scores.forEach((score, index) => {
      const col = index % 2 === 0 ? margin : margin + 80;
      doc.text(score, col, y);
      if (index % 2 !== 0) y += 8;
    });
    if (scores.length % 2 !== 0) y += 8;

    y += 5;

    // Helper to add sections
    const addSection = (title: string, items: string[]) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(title, margin, y);
      y += 8;

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      items.forEach(item => {
        const textLines = doc.splitTextToSize(`• ${item}`, pageWidth - margin * 2);
        if (y + (textLines.length * 6) > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(textLines, margin, y);
        y += textLines.length * 6 + 2;
      });
      y += 5;
    };

    addSection("Strengths", result.strengths);
    addSection("Areas for Improvement", result.weaknesses);
    addSection("Suggestions", result.suggestions);

    doc.save("story-analysis-report.pdf");
  };

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-slate-200 via-gray-100 to-indigo-100 text-slate-800 flex flex-col items-center justify-center p-4 sm:p-8 md:p-12 overflow-hidden">
      {/* Decorative Background Circles */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-blue-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200 rounded-full blur-3xl opacity-30 pointer-events-none"></div>

      {/* Top Navigation Bar */}
      <nav className="absolute top-0 left-0 right-0 p-4 sm:p-6 w-full flex justify-end items-center z-50">
        {user ? (
          <div className="flex items-center gap-3 bg-white/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/50 shadow-sm">
            {user.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full border border-indigo-200" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                {(user.user_metadata?.full_name?.[0] || user.email?.[0] || "?").toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold text-slate-700 hidden sm:block">
              {user.user_metadata?.full_name || user.email}
            </span>
            <div className="w-px h-5 bg-slate-200"></div>
            <Link
              href="/dashboard"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-colors shadow-sm"
            >
              Dashboard
            </Link>
            <button
              onClick={handleSignOut}
              className="text-xs font-bold text-rose-500 hover:text-rose-700 transition-colors bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-full"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button
            onClick={handleGoogleLogin}
            className="flex items-center space-x-2 bg-white/90 hover:bg-white backdrop-blur-md px-5 py-2.5 rounded-full border border-slate-200 shadow-sm hover:shadow-md transition-all font-semibold text-slate-700 text-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 15.01 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
            <span>Sign in with Google</span>
          </button>
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
            <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 pb-2">
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

          <div className="w-full relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-200 via-purple-200 to-pink-200 rounded-3xl blur opacity-40 group-hover:opacity-60 transition duration-500"></div>
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              disabled={loading}
              className="relative w-full h-72 sm:h-96 p-8 bg-white/90 backdrop-blur-md border border-white/50 rounded-3xl shadow-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none text-slate-800 placeholder-slate-400 text-lg transition-colors leading-relaxed disabled:opacity-70 disabled:cursor-not-allowed"
              placeholder="Paste your story here..."
            ></textarea>
          </div>
        </motion.div>

        {/* Action Button */}
        <motion.button
          onClick={handleAnalyze}
          disabled={loading || !story.trim()}
          whileHover={{ scale: (loading || !story.trim()) ? 1 : 1.03 }}
          whileTap={{ scale: (loading || !story.trim()) ? 1 : 0.98 }}
          className="relative inline-flex h-16 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-12 py-4 text-xl font-bold text-white shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/50 transition-shadow duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              Analyzing...
              <svg className="ml-3 w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </>
          ) : (
            <>
              Analyze Story
              <svg className="ml-2 w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </>
          )}
        </motion.button>

        {/* Result Section */}
        {result && (
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
              <p className="text-lg font-semibold italic text-slate-700">
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
                onClick={handleDownloadPdf}
                className="inline-flex items-center justify-center rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Download PDF
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
            <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
              {/* Overall Score Card */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="col-span-2 md:col-span-6 bg-white/80 backdrop-blur-md border border-white/50 rounded-3xl p-10 shadow-xl flex flex-col items-center justify-center hover:shadow-2xl transition-shadow"
              >
                <span className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-3 text-center">Overall Score</span>
                <span className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                  {result.overallScore}
                </span>
                <span className="text-slate-400 text-base mt-2 font-bold">/ 10</span>
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
                  className={`bg-white/90 backdrop-blur-sm border border-slate-100 rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg hover:shadow-xl transition-shadow ${item.bg}`}
                >
                  <span className="text-slate-500 text-[11px] sm:text-xs font-bold uppercase tracking-wider mb-2 text-center">{item.label}</span>
                  <span className={`text-4xl font-black ${item.color}`}>{item.score}</span>
                </motion.div>
              ))}
            </div>

            {/* Detailed Feedback Sections */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Strengths */}
              <motion.div
                whileHover={{ y: -2 }}
                className="bg-white/80 backdrop-blur-md border border-emerald-100 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-shadow hover:border-emerald-200"
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
                className="bg-white/80 backdrop-blur-md border border-rose-100 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-shadow hover:border-rose-200"
              >
                <h3 className="text-2xl font-black text-rose-600 flex items-center mb-6">
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
                className="bg-white/80 backdrop-blur-md border border-indigo-100 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-shadow hover:border-indigo-200"
              >
                <h3 className="text-2xl font-black text-indigo-600 flex items-center mb-6">
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
          </motion.div>
        )}

      </div>
    </main>
  );
}
