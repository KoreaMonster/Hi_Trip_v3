import ParticipantDetailPageContent from './ParticipantDetailPageContent';

type ParticipantDetailPageProps = {
  params: Promise<{ participantId: string }>;
  searchParams?: Promise<{ tripId?: string }>;
};

export default async function ParticipantDetailPage({ params, searchParams }: ParticipantDetailPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <ParticipantDetailPageContent
      participantId={Number(resolvedParams.participantId)}
      tripIdParam={resolvedSearchParams?.tripId}
    />
  );
}
