import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Compass, Home, BookOpen, Clock, Mail, Phone } from 'lucide-react';
import { usePageMetadata } from '../lib/usePageMetadata';

export const NotFoundPage: React.FC = () => {
  usePageMetadata(
    'Page Not Found (404) | CIT Campus Scheduler',
    'The requested Chilika Institute of Technology scheduling page could not be located. Navigate back to the master timetable, bookings, or user dashboard.'
  );

  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12 text-center">
      <div className="max-w-xl w-full bg-[#FFFDF8] p-8 sm:p-12 rounded-2xl border border-[#E4DBC6] shadow-sm relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FAF4E6] border border-[#E9D9AE] text-[#B08A3E] text-xs font-semibold">
            <Compass className="w-4 h-4" />
            <span>404 · Unscheduled Route</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#1F2A24] tracking-tight">
            Page Not Found
          </h1>

          <p className="text-sm text-[#55625A] max-w-md mx-auto leading-relaxed">
            The timetable view, venue reservation, or campus resource you are looking for has been moved or does not exist in the CIT schedule registry.
          </p>

          {/* Primary Quick Links */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/"
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-lg font-semibold text-xs text-white bg-[#B08A3E] hover:bg-[#9A7633] shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>Return to Dashboard</span>
            </Link>

            <Link
              to="/timetable"
              className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-lg font-semibold text-xs text-[#1F2A24] bg-[#FAF6EC] hover:bg-[#F2ECDC] border border-[#E4DBC6] transition-colors flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4 text-[#B08A3E]" />
              <span>View Master Timetable</span>
            </Link>
          </div>

          {/* Secondary Helpful Links */}
          <div className="pt-6 border-t border-[#E4DBC6] flex flex-wrap items-center justify-center gap-4 text-xs text-[#7C877F]">
            <Link to="/bookings" className="hover:text-[#1F2A24] transition-colors flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Book Venue
            </Link>
            <span>·</span>
            <Link to="/exams" className="hover:text-[#1F2A24] transition-colors flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Midsem Exams
            </Link>
            <span>·</span>
            <a href="mailto:scheduling@cit.edu" className="hover:text-[#1F2A24] transition-colors flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> scheduling@cit.edu
            </a>
            <span>·</span>
            <a href="tel:+916756200100" className="hover:text-[#1F2A24] transition-colors flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> +91 (6756) 200-100
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

