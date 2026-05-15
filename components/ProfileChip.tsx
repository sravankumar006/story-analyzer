"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { User } from "@supabase/supabase-js";

interface ProfileChipProps {
  user: User;
  onSignOut: () => Promise<void>;
}

export default function ProfileChip({ user, onSignOut }: ProfileChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fullName = user.user_metadata?.full_name || "Writer";
  const avatarUrl = user.user_metadata?.avatar_url;
  const initials = (user.user_metadata?.full_name?.[0] || user.email?.[0] || "?").toUpperCase();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Profile Chip - Light Subtle Version */}
      <motion.button
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02, y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center p-1 pr-3 sm:pr-5 rounded-full bg-white/40 backdrop-blur-2xl border border-white/60 shadow-[0_10px_30px_rgba(0,0,0,0.05)] hover:shadow-[0_15px_40px_rgba(0,0,0,0.08)] transition-all duration-500 outline-none"
      >
        {/* Subtle Shimmer/Glow Layer */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-100/20 via-purple-100/20 to-rose-100/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        
        {/* Avatar */}
        <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border border-white shadow-sm flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-indigo-400 font-bold text-sm sm:text-base font-playfair">
              {initials}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="hidden sm:flex flex-col items-start ml-3 text-left">
          <div className="flex items-center space-x-1.5">
            <span className="text-sm font-bold text-slate-800 font-inter line-clamp-1">{fullName}</span>
            <svg 
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-500 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} 
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-indigo-400 leading-none">Literary Member</span>
        </div>

        {/* Mobile Dropdown Icon */}
        <div className="sm:hidden ml-2">
          <svg 
            className={`w-4 h-4 text-slate-400 transition-transform duration-500 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} 
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </motion.button>

      {/* Dropdown Menu - Light Theme */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="absolute right-0 mt-3 w-60 bg-white/60 backdrop-blur-3xl border border-white/60 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden z-[60]"
          >
            <div className="p-2.5 space-y-1">
              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 px-4 py-3.5 rounded-2xl hover:bg-white/80 text-slate-600 hover:text-indigo-600 transition-all group"
              >
                <div className="p-2 rounded-xl bg-indigo-50/50 group-hover:bg-indigo-100/50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
                <span className="text-sm font-bold font-inter tracking-wide">View Dashboard</span>
              </Link>

              <Link
                href="/dashboard"
                onClick={() => setIsOpen(false)}
                className="flex items-center space-x-3 px-4 py-3.5 rounded-2xl hover:bg-white/80 text-slate-600 hover:text-purple-600 transition-all group"
              >
                <div className="p-2 rounded-xl bg-purple-50/50 group-hover:bg-purple-100/50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                </div>
                <span className="text-sm font-bold font-inter tracking-wide">Profile Settings</span>
              </Link>

              <div className="h-px bg-slate-100/50 my-1.5 mx-3" />

              <button
                onClick={() => {
                  setIsOpen(false);
                  onSignOut();
                }}
                className="w-full flex items-center space-x-3 px-4 py-3.5 rounded-2xl hover:bg-rose-50/80 text-slate-500 hover:text-rose-600 transition-all group"
              >
                <div className="p-2 rounded-xl bg-rose-50/50 group-hover:bg-rose-100/50 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                </div>
                <span className="text-sm font-bold font-inter tracking-wide">Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
