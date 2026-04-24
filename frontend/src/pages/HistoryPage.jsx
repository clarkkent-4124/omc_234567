import AlarmDetail from '../components/AlarmDetail';

export default function HistoryPage({ initialFilter }) {
  return (
    <div className="fade-in">
      <AlarmDetail initialFilter={initialFilter} onBack={null} showBackButton={false} />
    </div>
  );
}
