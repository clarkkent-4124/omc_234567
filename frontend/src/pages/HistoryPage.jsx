import AlarmDetail from '../components/AlarmDetail';

export default function HistoryPage({ initialFilter, isDesktop = false }) {
  return (
    <div className="fade-in">
      <AlarmDetail initialFilter={initialFilter} onBack={null} showBackButton={false} isDesktop={isDesktop} />
    </div>
  );
}
