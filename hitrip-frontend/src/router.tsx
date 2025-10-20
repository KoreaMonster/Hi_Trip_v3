import { createBrowserRouter } from "react-router-dom"
import HomePage from "@/app/page"
import LoginPage from "@/app/login/page"
import RegisterPage from "@/app/register/page"
import DashboardPage from "@/app/dashboard/page"
import MonitoringPage from "@/app/monitoring/page"
import RecommendationsPage from "@/app/recommendations/page"
import RecommendationDetailPage from "@/app/recommendations/[id]/page"
import TripsPlanningPage from "@/app/trips/planning/page"
import OngoingTripsPage from "@/app/trips/ongoing/page"
import ParticipantsPage from "@/app/trips/[id]/participants/page"
import ParticipantDetailPage from "@/app/trips/[id]/participants/[participantId]/page"
import TripSchedulesPage from "@/app/trips/[id]/schedules/page"
import PlaceDetailPage from "@/app/trips/[id]/schedules/[scheduleId]/places/[placeId]/page"
import NotFoundPage from "@/src/pages/NotFoundPage"
import SchedulesPlaceholderPage from "@/src/pages/SchedulesPlaceholderPage"
import CompletedTripsPlaceholderPage from "@/src/pages/CompletedTripsPlaceholderPage"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage />, 
  },
  {
    path: "/login",
    element: <LoginPage />, 
  },
  {
    path: "/register",
    element: <RegisterPage />, 
  },
  {
    path: "/dashboard",
    element: <DashboardPage />, 
  },
  {
    path: "/monitoring",
    element: <MonitoringPage />, 
  },
  {
    path: "/recommendations",
    element: <RecommendationsPage />, 
  },
  {
    path: "/recommendations/:id",
    element: <RecommendationDetailPage />, 
  },
  {
    path: "/trips/planning",
    element: <TripsPlanningPage />, 
  },
  {
    path: "/schedules",
    element: <SchedulesPlaceholderPage />, 
  },
  {
    path: "/trips/ongoing",
    element: <OngoingTripsPage />, 
  },
  {
    path: "/trips/:id/participants",
    element: <ParticipantsPage />, 
  },
  {
    path: "/trips/:id/participants/:participantId",
    element: <ParticipantDetailPage />, 
  },
  {
    path: "/trips/:id/schedules",
    element: <TripSchedulesPage />, 
  },
  {
    path: "/trips/:id/schedules/:scheduleId/places/:placeId",
    element: <PlaceDetailPage />, 
  },
  {
    path: "/trips/completed",
    element: <CompletedTripsPlaceholderPage />, 
  },
  {
    path: "*",
    element: <NotFoundPage />, 
  },
])
