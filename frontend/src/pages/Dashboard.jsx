import SummaryCards from '../components/SummaryCards';
import DonutChart from '../components/DonutChart';
import BarChart24h from '../components/BarChart24h';
import BarChartUP3 from '../components/BarChartUP3';
import GIList from '../components/GIList';

function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const _now  = new Date();
const DARI  = localDate(new Date(_now.getFullYear(), _now.getMonth(), 1));
const SAMPAI = localDate(new Date(_now.getFullYear(), _now.getMonth() + 1, 0));

const filterProps = { dari: DARI, sampai: SAMPAI };

export default function Dashboard({ onCardClick, onGIClick, isDesktop = false }) {
  if (isDesktop) {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Baris 1: Summary cards full width */}
        <SummaryCards onCardClick={onCardClick} isDesktop />

        {/* Baris 2: Donut (kiri) + UP3 chart (kanan) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20, alignItems: 'stretch' }}>
          <DonutChart  {...filterProps} />
          <BarChartUP3 {...filterProps} />
        </div>

        {/* Baris 3: GI List full width */}
        <GIList {...filterProps} onGIClick={onGIClick} />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SummaryCards onCardClick={onCardClick} />
      <DonutChart  {...filterProps} />
      <BarChart24h {...filterProps} />
      <GIList      {...filterProps} onGIClick={onGIClick} />
      <div style={{ height: 8 }} />
    </div>
  );
}
