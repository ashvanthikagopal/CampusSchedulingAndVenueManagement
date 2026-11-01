import React from 'react';
import { useAuth } from '../lib/authContext';
import { usePageMetadata } from '../lib/usePageMetadata';
import { AdminDashboard } from './AdminDashboard';
import { CoordinatorDashboard } from './CoordinatorDashboard';
import { FacultyDashboard } from './FacultyDashboard';
import { ClubDashboard } from './ClubDashboard';

export const Dashboard: React.FC = () => {
  usePageMetadata(
    'Campus Scheduling Dashboard | CIT Schedule Portal',
    'Chilika Institute of Technology central scheduling matrix, role-scoped workflows, venue allocation metrics, and solver-verified timetables.'
  );

  const { user } = useAuth();

  switch (user?.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'department_coordinator':
      return <CoordinatorDashboard />;
    case 'faculty':
      return <FacultyDashboard />;
    case 'club':
      return <ClubDashboard />;
    default:
      return <AdminDashboard />;
  }
};

export default Dashboard;
