import LeadsListView from '@/components/LeadsListView';

export default function InterestedScreen() {
  return (
    <LeadsListView
      fixedStatus="interested"
      emptyText="No interested leads yet — mark a lead's status as Interested to see it here."
    />
  );
}
