import { useState, useRef, useCallback } from 'react';
import SummaryCards from '../components/SummaryCards';
import FilterCard from '../components/FilterCard';
import DonutChart from '../components/DonutChart';
import BarChart24h from '../components/BarChart24h';
import GIList from '../components/GIList';

const today = new Date().toISOString().split('T')[0];
const FETCH_COUNT = 3; // DonutChart + BarChart24h + GIList

export default function Dashboard({ onCardClick, onGIClick }) {
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

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SummaryCards onCardClick={onCardClick} />
      <FilterCard
        dari={dari}
        sampai={sampai}
        setDari={setDari}
        setSampai={setSampai}
        onApply={handleApply}
        applying={applying}
      />
      <DonutChart  dari={appliedDari} sampai={appliedSampai} filterKey={filterKey} applying={applying} onFetchDone={onFetchDone} />
      <BarChart24h dari={appliedDari} sampai={appliedSampai} filterKey={filterKey} applying={applying} onFetchDone={onFetchDone} />
      <GIList      dari={appliedDari} sampai={appliedSampai} filterKey={filterKey} applying={applying} onFetchDone={onFetchDone} onGIClick={onGIClick} />
      <div style={{ height: 8 }} />
    </div>
  );
}
