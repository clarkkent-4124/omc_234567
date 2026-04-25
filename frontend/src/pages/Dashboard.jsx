import { useState, useRef, useCallback } from 'react';
import SummaryCards from '../components/SummaryCards';
import FilterCard from '../components/FilterCard';
import DonutChart from '../components/DonutChart';
import BarChart24h from '../components/BarChart24h';
import GIList from '../components/GIList';

const today = new Date().toISOString().split('T')[0];
const FETCH_COUNT = 3; // DonutChart + BarChart24h + GIList

export default function Dashboard({ onCardClick, onGIClick, isDesktop = false }) {
  const [dari, setDari]         = useState(today);
  const [sampai, setSampai]     = useState(today);
  const [appliedDari, setAppliedDari]   = useState(today);
  const [appliedSampai, setAppliedSampai] = useState(today);
  const [applying, setApplying] = useState(false);
  const [filterKey, setFilterKey] = useState(0); // naik setiap klik Terapkan → paksa useEffect anak

  const doneCount  = useRef(0);
  const startTime  = useRef(0);
  const MIN_DELAY  = 1000; // ms

  function handleApply() {
    doneCount.current = 0;
    startTime.current = Date.now();
    setApplying(true);
    setAppliedDari(dari);
    setAppliedSampai(sampai);
    setFilterKey(k => k + 1);
  }

  const onFetchDone = useCallback(() => {
    doneCount.current += 1;
    if (doneCount.current >= FETCH_COUNT) {
      const elapsed   = Date.now() - startTime.current;
      const remaining = Math.max(0, MIN_DELAY - elapsed);
      setTimeout(() => setApplying(false), remaining);
    }
  }, []);

  const filterProps = { dari: appliedDari, sampai: appliedSampai, filterKey, applying, onFetchDone };

  if (isDesktop) {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Baris 1: Summary cards (kiri) + Filter (kanan) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: 20, alignItems: 'stretch' }}>
          <SummaryCards onCardClick={onCardClick} isDesktop />
          <FilterCard dari={dari} sampai={sampai} setDari={setDari} setSampai={setSampai} onApply={handleApply} applying={applying} />
        </div>

        {/* Baris 2: Donut (kiri) + Bar chart (kanan) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 20, alignItems: 'start' }}>
          <DonutChart  {...filterProps} />
          <BarChart24h {...filterProps} />
        </div>

        {/* Baris 3: GI List full width */}
        <GIList {...filterProps} onGIClick={onGIClick} />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SummaryCards onCardClick={onCardClick} />
      <FilterCard dari={dari} sampai={sampai} setDari={setDari} setSampai={setSampai} onApply={handleApply} applying={applying} />
      <DonutChart  {...filterProps} />
      <BarChart24h {...filterProps} />
      <GIList      {...filterProps} onGIClick={onGIClick} />
      <div style={{ height: 8 }} />
    </div>
  );
}
