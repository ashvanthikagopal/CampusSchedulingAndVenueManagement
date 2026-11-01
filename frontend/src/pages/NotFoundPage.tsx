import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Compass, ArrowLeft, Home, BookOpen, Clock, Mail, Phone } from 'lucide-react';
import { usePageMetadata } from '../lib/usePageMetadata';

export const NotFoundPage: React.FC = () => {
  usePageMetadata(
    'Page Not Found (404) | CIT Campus Scheduler',
    'The requested Chilika Institute of Technology scheduling page could not be located. Navigate back to the master timetable, bookings, or user dashboard.'
  );

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-16 text-center">
      <div className="max-w-2xl w-full glass-panel p-8 sm:p-12 rounded-3xl border border-slate-800 bg-slate-900/60 shadow-2xl relative overflow-hidden">
        {/* Decorative Background Glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
            <Compass className="w-4 h-4" />
            <span>404 · Unscheduled Route</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
            Page Not Found
          </h1>

          <p className="text-base text-slate-300 max-w-lg mx-auto leading-relaxed">
            The timetable view, venue reservation, or resource you are looking for has been moved or does not exist in the CIT schedule registry.
          </p>

          {/* Primary Quick Links */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/"
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>Go to Home / Dashboard</span>
            </Link>

            <Link
              to="/timetable"
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl font-semibold text-sm text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4 text-sky-400" />
              <span>View Master Timetable</span>
            </Link>
          </div>

          {/* Secondary Helpful Links */}
          <div className="pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
            <Link to="/bookings" className="hover:text-sky-400 transition-colors flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Book Venue
            </Link>
            <span>·</span>
            <Link to="/exams" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Midsem Exams
            </Link>
            <span>·</span>
            <a href="mailto:scheduling@cit.edu" className="hover:text-white transition-colors flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> scheduling@cit.edu
            </a>
            <span>·</span>
            <a href="tel:+916756200100" className="hover:text-white transition-colors flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> +91 (6756) 200-100
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

