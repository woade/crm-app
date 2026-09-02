import LeadsListView from '@/components/LeadsListView';

export default function ContactedScreen() {
  return (
    <LeadsListView
      fixedStatus="contacted"
      emptyText="No contacted leads yet — log a call on a lead to move it here."
    />
  );
}
