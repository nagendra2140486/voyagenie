import { request } from './client';
import type { AiResult, Destination, GovernanceView, TravelPackage, Trip } from '../types';

export const fetchDestinations = (params: Record<string, string>) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  return request<{ count: number; destinations: Destination[] }>(`/api/destinations?${query}`);
};

export const fetchDestinationFilters = () =>
  request<{ countries: string[]; styles: string[]; seasons: string[]; budgetLevels: string[] }>(
    '/api/destinations/filters',
  );

export const fetchDestination = (id: string) =>
  request<{ destination: Destination; related: Destination[]; packages: TravelPackage[] }>(
    `/api/destinations/${id}`,
  );

export const fetchPackages = (params: Record<string, string> = {}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  return request<{ count: number; packages: TravelPackage[] }>(`/api/packages?${query}`);
};

export const fetchTrips = () => request<{ count: number; trips: Trip[] }>('/api/trips');

export const createTrip = (body: {
  title: string;
  destination: string;
  days?: number;
  budget?: string;
  travelType?: string;
  source?: string;
  itineraryText: string;
}) => request<{ trip: Trip }>('/api/trips', { method: 'POST', body });

export const deleteTrip = (id: number) => request<void>(`/api/trips/${id}`, { method: 'DELETE' });

export const cloneTrip = (id: number) => request<{ trip: Trip }>(`/api/trips/${id}/clone`, { method: 'POST' });

export const renameTrip = (id: number, title: string) =>
  request<{ trip: Trip }>(`/api/trips/${id}`, { method: 'PATCH', body: { title } });

export const submitInquiry = (body: { name: string; email: string; subject?: string; message: string }) =>
  request<{ inquiry: { id: number; created_at: string } }>('/api/contact', { method: 'POST', body });

export const generateItinerary = (body: {
  destination: string;
  days: number;
  budget: string;
  travel_type: string;
  interests: string[];
  constraints: string;
}) => request<AiResult>('/ai/itinerary', { method: 'POST', body });

export const askAssistant = (body: { message: string; history: { role: 'user' | 'assistant'; content: string }[] }) =>
  request<AiResult>('/ai/chat', { method: 'POST', body });

export const optimizeBudget = (body: {
  destination: string;
  days: number;
  budget_amount: number;
  currency: string;
  travellers: number;
  travel_style: string;
}) => request<AiResult>('/ai/budget', { method: 'POST', body });

export const fetchGovernance = () => request<GovernanceView>('/api/llm-audit?limit=50');
