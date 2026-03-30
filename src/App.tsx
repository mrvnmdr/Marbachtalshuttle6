import React, { useState, useEffect } from 'react';
import { Calendar, Car, Users, Trash2, Plus, TrendingUp, Download, RefreshCw, AlertCircle, BarChart2 } from 'lucide-react';
import { supabase } from './supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
  PieChart, Pie, Cell
} from 'recharts';

interface CarType {
  id: number;
  name: string;
  ownerId: number;
  roundtripCost: number;
}

interface PersonType {
  id: number;
  name: string;
}

interface CommuteType {
  id: number;
  date: string;
  tripType: string;
  selectedCars: number[];
  selectedPersons: number[];
  drivers: number[];
  pricePerPerson: number;
}

// ─── Abrechnungslogik (aus Python-Skript übersetzt) ──────────────────────────

/**
 * Berechnet den Saldo jeder Person über alle Fahrten.
 * Passagiere: saldo -= pricePerPerson
 * Fahrer: saldo += (Gesamtkosten der Fahrt / Anzahl Fahrer)
 */
function berechneAbrechnung(commutes: CommuteType[]): Record<number, number> {
  const saldo: Record<number, number> = {};

  for (const trip of commutes) {
    const { selectedPersons, drivers, pricePerPerson } = trip;
    const total = selectedPersons.length * pricePerPerson;
    const driverShare = total / drivers.length;

    for (const p of selectedPersons) {
      saldo[p] = (saldo[p] ?? 0) - pricePerPerson;
    }
    for (const d of drivers) {
      saldo[d] = (saldo[d] ?? 0) + driverShare;
    }
  }

  return saldo;
}

/**
 * Erstellt einen minimalen Zahlungsplan aus dem Saldo-Dictionary.
 * Greedy-Algorithmus: immer den größten Schuldner mit dem größten Gläubiger verrechnen.
 */
function zahlungsplan(
  saldo: Record<number, number>
): { von: number; an: number; betrag: number }[] {
  const zahler: [number, number][] = [];
  const empfaenger: [number, number][] = [];

  for (const [id, betrag] of Object.entries(saldo)) {
    const numId = parseInt(id);
    if (betrag < -0.005) zahler.push([numId, -betrag]);
    else if (betrag > 0.005) empfaenger.push([numId, betrag]);
  }

  const ueberweisungen: { von: number; an: number; betrag: number }[] = [];
  let i = 0, j = 0;

  while (i < zahler.length && j < empfaenger.length) {
    const [zahlPerson, schuld] = zahler[i];
    const [empfPerson, forderung] = empfaenger[j];

    const betrag = Math.min(schuld, forderung);
    ueberweisungen.push({ von: zahlPerson, an: empfPerson, betrag });

    zahler[i][1] -= betrag;
    empfaenger[j][1] -= betrag;

    if (zahler[i][1] < 0.005) i++;
    if (empfaenger[j][1] < 0.005) j++;
  }

  return ueberweisungen;
}

// ─── Farben für Charts ────────────────────────────────────────────────────────
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
const CommuteCostCalculator = () => {
  const [activeTab, setActiveTab] = useState('commutes');
  const [cars, setCars] = useState<CarType[]>([]);
  const [persons, setPersons] = useState<PersonType[]>([]);
  const [commutes, setCommutes] = useState<CommuteType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCar, setNewCar] = useState({
    name: '',
    ownerId: '',
    newOwnerName: '',
    roundtripCost: ''
  });
  const [newPerson, setNewPerson] = useState('');
  const [newCommute, setNewCommute] = useState({
    date: new Date().toISOString().split('T')[0],
    tripType: 'roundtrip',
    selectedCars: [] as number[],
    selectedPersons: [] as number[]
  });

  useEffect(() => {
    if (!supabase) {
      setError('Supabase ist nicht konfiguriert. Bitte stelle sicher, dass die Umgebungsvariablen VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY gesetzt sind.');
      setLoading(false);
      return;
    }
    loadData();
  }, []);

  const transformCar = (car: any): CarType => ({
    id: car.id,
    name: car.name,
    ownerId: car.owner_id,
    roundtripCost: parseFloat(car.roundtrip_cost)
  });

  const transformCommute = (c: any): CommuteType => ({
    id: c.id,
    date: c.date,
    tripType: c.trip_type,
    selectedCars: c.selected_cars,
    selectedPersons: c.selected_persons,
    drivers: c.drivers,
    pricePerPerson: parseFloat(c.price_per_person)
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [carsRes, personsRes, commutesRes] = await Promise.all([
        supabase.from('cars').select('*').order('id'),
        supabase.from('persons').select('*').order('id'),
        supabase.from('commutes').select('*').order('date', { ascending: false })
      ]);

      if (carsRes.error || personsRes.error || commutesRes.error) {
        const errorMsg = carsRes.error || personsRes.error || commutesRes.error;
        throw new Error(errorMsg?.message || 'Fehler beim Laden der Daten');
      }

      setCars((carsRes.data || []).map(transformCar));
      setPersons(personsRes.data || []);
      setCommutes((commutesRes.data || []).map(transformCommute));
    } catch (err: any) {
      setError(`Fehler: ${err?.message || 'Verbindung zur Datenbank fehlgeschlagen'}`);
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const addCar = async () => {
    if (!newCar.name || !newCar.roundtripCost) return;

    let ownerId: number;

    if (newCar.ownerId === 'new') {
      if (!newCar.newOwnerName.trim()) {
        alert('Bitte gib einen Namen für den neuen Besitzer ein');
        return;
      }
      try {
        const { data, error } = await supabase
          .from('persons')
          .insert([{ name: newCar.newOwnerName.trim() }])
          .select()
          .single();

        if (error) throw error;
        setPersons([...persons, data]);
        ownerId = data.id;
      } catch {
        alert('Fehler beim Erstellen der Person');
        return;
      }
    } else if (!newCar.ownerId) {
      alert('Bitte wähle einen Besitzer aus');
      return;
    } else {
      ownerId = parseInt(newCar.ownerId);
    }

    try {
      const { data, error } = await supabase
        .from('cars')
        .insert([{
          name: newCar.name,
          owner_id: ownerId,
          roundtrip_cost: parseFloat(newCar.roundtripCost)
        }])
        .select()
        .single();

      if (error) throw error;
      setCars([...cars, transformCar(data)]);
      setNewCar({ name: '', ownerId: '', newOwnerName: '', roundtripCost: '' });
    } catch {
      alert('Fehler beim Erstellen des Autos');
    }
  };

  const deleteCar = async (id: number) => {
    try {
      const { error } = await supabase.from('cars').delete().eq('id', id);
      if (error) throw error;
      setCars(cars.filter(c => c.id !== id));
    } catch {
      alert('Fehler beim Löschen des Autos');
    }
  };

  const addPerson = async () => {
    if (!newPerson) return;
    try {
      const { data, error } = await supabase
        .from('persons')
        .insert([{ name: newPerson }])
        .select()
        .single();

      if (error) throw error;
      setPersons([...persons, data]);
      setNewPerson('');
    } catch {
      alert('Fehler beim Erstellen der Person');
    }
  };

  const deletePerson = async (id: number) => {
    const ownsACar = cars.some(car => car.ownerId === id);
    if (ownsACar) {
      alert('Diese Person kann nicht gelöscht werden, da sie Besitzer eines Autos ist.');
      return;
    }
    try {
      const { error } = await supabase.from('persons').delete().eq('id', id);
      if (error) throw error;
      setPersons(persons.filter(p => p.id !== id));
    } catch {
      alert('Fehler beim Löschen der Person');
    }
  };

  const calculatePrice = (numCars: number, numPersons: number, tripType: string, selectedCarIds: number[]) => {
    const isRoundtrip = tripType === 'roundtrip';

    if (numCars === 1) {
      const car = cars.find(c => c.id === selectedCarIds[0]);
      if (!car) return 0;
      const baseCost = isRoundtrip ? car.roundtripCost : (car.roundtripCost / 2);
      return baseCost / numPersons;
    } else {
      let totalCarCost = 0;
      selectedCarIds.forEach(carId => {
        const car = cars.find(c => c.id === carId);
        if (car) totalCarCost += tripType === 'roundtrip' ? car.roundtripCost : (car.roundtripCost / 2);
      });
      return totalCarCost / numPersons;
    }
  };

  const toggleCarSelection = (carId: number) => {
    const selected = newCommute.selectedCars.includes(carId)
      ? newCommute.selectedCars.filter(id => id !== carId)
      : [...newCommute.selectedCars, carId];
    setNewCommute({ ...newCommute, selectedCars: selected });
  };

  const togglePersonSelection = (personId: number) => {
    const selected = newCommute.selectedPersons.includes(personId)
      ? newCommute.selectedPersons.filter(id => id !== personId)
      : [...newCommute.selectedPersons, personId];
    setNewCommute({ ...newCommute, selectedPersons: selected });
  };

  const addCommute = async () => {
    if (newCommute.selectedCars.length === 0 || newCommute.selectedPersons.length === 0) {
      alert('Bitte wähle mindestens ein Auto und eine Person aus');
      return;
    }

    const drivers = newCommute.selectedCars.map(carId => {
      const car = cars.find(c => c.id === carId);
      return car?.ownerId;
    }).filter((id): id is number => id !== undefined);

    const pricePerPerson = calculatePrice(
      newCommute.selectedCars.length,
      newCommute.selectedPersons.length,
      newCommute.tripType,
      newCommute.selectedCars
    );

    try {
      const { data, error } = await supabase
        .from('commutes')
        .insert([{
          date: newCommute.date,
          trip_type: newCommute.tripType,
          selected_cars: newCommute.selectedCars,
          selected_persons: newCommute.selectedPersons,
          drivers,
          price_per_person: pricePerPerson
        }])
        .select()
        .single();

      if (error) throw error;
      setCommutes([transformCommute(data), ...commutes]);

      setNewCommute({
        date: new Date().toISOString().split('T')[0],
        tripType: 'roundtrip',
        selectedCars: [],
        selectedPersons: []
      });
    } catch {
      alert('Fehler beim Erstellen der Fahrt');
    }
  };

  const deleteCommute = async (id: number) => {
    try {
      const { error } = await supabase.from('commutes').delete().eq('id', id);
      if (error) throw error;
      setCommutes(commutes.filter(c => c.id !== id));
    } catch {
      alert('Fehler beim Löschen der Fahrt');
    }
  };

  const getOwnerName = (ownerId: number) => {
    return persons.find(p => p.id === ownerId)?.name || 'Unbekannt';
  };

  const getPersonName = (id: number) => persons.find(p => p.id === id)?.name || `Person ${id}`;

  const getMonths = (): string[] => {
    const months: string[] = Array.from(new Set(commutes.map(c => c.date.substring(0, 7))));
    return months.sort().reverse();
  };

  // ─── Abrechnung (neue Logik aus Python) ──────────────────────────────────────

  const getSettlementsForMonth = (month: string) => {
    const monthCommutes = commutes.filter(c => c.date.substring(0, 7) === month);
    const saldo = berechneAbrechnung(monthCommutes);
    const zahlungen = zahlungsplan(saldo);
    return { saldo, zahlungen };
  };

  const downloadMonthlyReport = (month: string) => {
    const { saldo, zahlungen } = getSettlementsForMonth(month);
    const [year, monthNum] = month.split('-');
    const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric'
    });

    let csv = `Abrechnung ${monthName}\n\n`;
    csv += 'Saldo pro Person\n';
    csv += 'Person,Saldo (€)\n';
    for (const [id, betrag] of Object.entries(saldo)) {
      csv += `${getPersonName(parseInt(id))},${betrag.toFixed(2)}\n`;
    }
    csv += '\nZahlungsplan (minimale Überweisungen)\n';
    csv += 'Von,An,Betrag (€)\n';
    for (const { von, an, betrag } of zahlungen) {
      csv += `${getPersonName(von)},${getPersonName(an)},${betrag.toFixed(2)}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Abrechnung_${month}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── Dashboard-Daten ──────────────────────────────────────────────────────────

  // Fahrten pro Person (als Fahrer + Mitfahrer)
  const fahrerData = persons.map(person => ({
    name: person.name,
    Mitgefahren: commutes.filter(c => c.selectedPersons.includes(person.id) && !c.drivers.includes(person.id)).length,
    Gefahren: commutes.filter(c => c.drivers.includes(person.id)).length,
  }));

  // Fahrten pro Monat
  const fahrtMonatData = (() => {
    const counts: Record<string, number> = {};
    for (const c of commutes) {
      const m = c.date.substring(0, 7);
      counts[m] = (counts[m] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monat, fahrten]) => ({
        monat: new Date(monat + '-01').toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
        Fahrten: fahrten
      }));
  })();

  // Kostenaufteilung: Gesamtbetrag pro Person
  const kostenData = (() => {
    const totals: Record<number, number> = {};
    for (const c of commutes) {
      for (const pId of c.selectedPersons) {
        totals[pId] = (totals[pId] ?? 0) + c.pricePerPerson;
      }
    }
    return Object.entries(totals).map(([id, total]) => ({
      name: getPersonName(parseInt(id)),
      value: parseFloat(total.toFixed(2))
    }));
  })();

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Lade Daten...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-lg shadow max-w-md border border-red-200">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <p className="text-red-600 mb-4 font-medium">{error}</p>
          <button onClick={loadData} className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Car className="text-blue-600" />
            Pendel-Kostenrechner
          </h1>
          <button onClick={loadData} className="text-gray-600 hover:text-blue-600 p-2" title="Daten aktualisieren">
            <RefreshCw size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b flex-wrap">
            {[
              { key: 'commutes', label: 'Fahrten', icon: <Calendar size={18} /> },
              { key: 'cars', label: 'Autos', icon: <Car size={18} /> },
              { key: 'persons', label: 'Personen', icon: <Users size={18} /> },
              { key: 'settlements', label: 'Abrechnung', icon: <TrendingUp size={18} /> },
              { key: 'dashboard', label: 'Dashboard', icon: <BarChart2 size={18} /> },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-4 py-3 font-medium min-w-fit flex items-center justify-center gap-2 ${
                  activeTab === tab.key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab: Autos ── */}
        {activeTab === 'cars' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Autos verwalten</h2>
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input type="text" placeholder="Auto Name (z.B. BMW X5)" value={newCar.name}
                  onChange={(e) => setNewCar({ ...newCar, name: e.target.value })}
                  className="border rounded px-3 py-2" />
                <select value={newCar.ownerId}
                  onChange={(e) => setNewCar({ ...newCar, ownerId: e.target.value })}
                  className="border rounded px-3 py-2">
                  <option value="">Besitzer wählen...</option>
                  {persons.map(person => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                  <option value="new">+ Neue Person erstellen</option>
                </select>
                <input type="number" step="0.01" placeholder="Kosten Hin & Rück (€)" value={newCar.roundtripCost}
                  onChange={(e) => setNewCar({ ...newCar, roundtripCost: e.target.value })}
                  className="border rounded px-3 py-2" />
                <button onClick={addCar}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 justify-center">
                  <Plus size={18} /> Hinzufügen
                </button>
              </div>
              {newCar.ownerId === 'new' && (
                <input type="text" placeholder="Name der neuen Person" value={newCar.newOwnerName}
                  onChange={(e) => setNewCar({ ...newCar, newOwnerName: e.target.value })}
                  className="border rounded px-3 py-2 border-blue-400" />
              )}
            </div>
            <div className="space-y-2">
              {cars.map(car => (
                <div key={car.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{car.name}</span>
                    <span className="text-gray-600 ml-2">({getOwnerName(car.ownerId)})</span>
                    <span className="ml-3 text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      Hin & Rück: {car.roundtripCost.toFixed(2)} € | Einfach: {(car.roundtripCost / 2).toFixed(2)} €
                    </span>
                  </div>
                  <button onClick={() => deleteCar(car.id)} className="text-red-600 hover:text-red-800">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab: Personen ── */}
        {activeTab === 'persons' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Personen verwalten</h2>
            <div className="flex gap-4 mb-6 flex-col sm:flex-row">
              <input type="text" placeholder="Name" value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
                className="flex-1 border rounded px-3 py-2" />
              <button onClick={addPerson}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2">
                <Plus size={18} /> Hinzufügen
              </button>
            </div>
            <div className="space-y-2">
              {persons.map(person => {
                const ownsCar = cars.some(car => car.ownerId === person.id);
                return (
                  <div key={person.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <span className="font-medium">{person.name}</span>
                      {ownsCar && (
                        <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Autobesitzer</span>
                      )}
                    </div>
                    <button onClick={() => deletePerson(person.id)} className="text-red-600 hover:text-red-800"
                      title={ownsCar ? 'Person besitzt ein Auto und kann nicht gelöscht werden' : 'Person löschen'}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Tab: Fahrten ── */}
        {activeTab === 'commutes' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Neue Fahrt erfassen</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Datum</label>
                  <input type="date" value={newCommute.date}
                    onChange={(e) => setNewCommute({ ...newCommute, date: e.target.value })}
                    className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Fahrttyp</label>
                  <select value={newCommute.tripType}
                    onChange={(e) => setNewCommute({ ...newCommute, tripType: e.target.value })}
                    className="w-full border rounded px-3 py-2">
                    <option value="oneway">Einfach</option>
                    <option value="roundtrip">Hin & Rück</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Autos auswählen (Besitzer = Fahrer)</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {cars.map(car => (
                    <button key={car.id} onClick={() => toggleCarSelection(car.id)}
                      className={`p-3 rounded border-2 text-left ${
                        newCommute.selectedCars.includes(car.id)
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200'
                      }`}>
                      <div className="font-medium">{car.name}</div>
                      <div className="text-xs text-gray-600">Fahrer: {getOwnerName(car.ownerId)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Alle Personen auswählen (inkl. Fahrer)</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {persons.map(person => (
                    <button key={person.id} onClick={() => togglePersonSelection(person.id)}
                      className={`p-3 rounded border-2 ${
                        newCommute.selectedPersons.includes(person.id)
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200'
                      }`}>
                      {person.name}
                    </button>
                  ))}
                </div>
              </div>

              {newCommute.selectedCars.length > 0 && newCommute.selectedPersons.length > 0 && (
                <div className="bg-blue-50 p-4 rounded mb-4">
                  <div className="text-sm font-medium mb-2">Kosten pro Person:</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {calculatePrice(
                      newCommute.selectedCars.length,
                      newCommute.selectedPersons.length,
                      newCommute.tripType,
                      newCommute.selectedCars
                    ).toFixed(2)} €
                  </div>
                </div>
              )}

              <button onClick={addCommute}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 font-medium">
                Fahrt hinzufügen
              </button>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Alle Fahrten</h2>
              <div className="space-y-3">
                {commutes.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Noch keine Fahrten erfasst</p>
                ) : (
                  commutes.map(commute => (
                    <div key={commute.id} className="p-4 bg-gray-50 rounded">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium">{commute.date}</div>
                          <div className="text-sm text-gray-600">
                            {commute.tripType === 'roundtrip' ? 'Hin & Rück' : 'Einfach'}
                          </div>
                        </div>
                        <button onClick={() => deleteCommute(commute.id)} className="text-red-600 hover:text-red-800">
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Autos:</span>{' '}
                          {commute.selectedCars.map(carId => cars.find(c => c.id === carId)?.name).join(', ')}
                        </div>
                        <div>
                          <span className="font-medium">Personen:</span>{' '}
                          {commute.selectedPersons.map(pId => persons.find(p => p.id === pId)?.name).join(', ')}
                        </div>
                      </div>
                      <div className="mt-2 text-lg font-bold text-blue-600">
                        {commute.pricePerPerson.toFixed(2)} € pro Person
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab: Abrechnung (neue Python-Logik) ── */}
        {activeTab === 'settlements' && (
          <div className="space-y-6">
            {getMonths().length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-500 text-center py-8">Noch keine Fahrten zum Abrechnen</p>
              </div>
            ) : (
              getMonths().map(month => {
                const { saldo, zahlungen } = getSettlementsForMonth(month);
                const [year, monthNum] = month.split('-');
                const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('de-DE', {
                  month: 'long',
                  year: 'numeric'
                });

                return (
                  <div key={month} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
                      <h3 className="text-lg font-semibold capitalize">{monthName}</h3>
                      <button onClick={() => downloadMonthlyReport(month)}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2">
                        <Download size={18} /> CSV Download
                      </button>
                    </div>

                    {/* Saldo pro Person */}
                    <div className="mb-5">
                      <h4 className="font-medium mb-3 text-gray-700">Saldo pro Person:</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {Object.entries(saldo).map(([id, betrag]) => (
                          <div key={id}
                            className={`p-3 rounded-lg border-2 text-center ${
                              betrag >= 0
                                ? 'border-green-200 bg-green-50'
                                : 'border-red-200 bg-red-50'
                            }`}>
                            <div className="font-medium text-sm text-gray-700">{getPersonName(parseInt(id))}</div>
                            <div className={`text-lg font-bold mt-1 ${betrag >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {betrag >= 0 ? '+' : ''}{betrag.toFixed(2)} €
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {betrag >= 0 ? '⬆ bekommt zurück' : '⬇ schuldet'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Zahlungsplan */}
                    <div>
                      <h4 className="font-medium mb-3 text-gray-700">
                        Optimierter Zahlungsplan <span className="text-xs font-normal text-gray-500">(minimale Überweisungen)</span>
                      </h4>
                      {zahlungen.length === 0 ? (
                        <div className="text-sm text-gray-500 bg-gray-50 rounded p-3">
                          ✅ Alle Schulden sind bereits beglichen.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {zahlungen.map(({ von, an, betrag }, idx) => (
                            <div key={idx}
                              className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                              <span className="font-medium text-gray-800">{getPersonName(von)}</span>
                              <span className="text-gray-400">→</span>
                              <span className="font-medium text-gray-800">{getPersonName(an)}</span>
                              <span className="ml-auto font-bold text-amber-700">{betrag.toFixed(2)} €</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Tab: Dashboard ── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">

            {commutes.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-6">
                <p className="text-gray-500 text-center py-8">Noch keine Fahrten für das Dashboard</p>
              </div>
            ) : (
              <>
                {/* Statistik-Kacheln */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Fahrten gesamt', value: commutes.length, color: 'blue' },
                    { label: 'Personen', value: persons.length, color: 'green' },
                    { label: 'Autos', value: cars.length, color: 'purple' },
                    {
                      label: 'Gesamtkosten',
                      value: commutes.reduce((sum, c) => sum + c.pricePerPerson * c.selectedPersons.length, 0).toFixed(2) + ' €',
                      color: 'amber'
                    },
                  ].map(stat => (
                    <div key={stat.label} className={`bg-white rounded-lg shadow p-4 border-l-4 border-${stat.color}-500`}>
                      <div className="text-sm text-gray-500">{stat.label}</div>
                      <div className={`text-2xl font-bold text-${stat.color}-600 mt-1`}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Fahrten pro Person */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-700">Fahrten pro Person</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={fahrerData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Gefahren" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Mitgefahren" stackId="a" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Fahrten über Zeit */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-700">Fahrten pro Monat</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={fahrtMonatData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="monat" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="Fahrten"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={{ r: 5, fill: '#3b82f6' }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Kostenaufteilung */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4 text-gray-700">Kostenaufteilung pro Person (gesamt)</h3>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={kostenData}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={true}
                        >
                          {kostenData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => `${value.toFixed(2)} €`} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Legende mit Beträgen */}
                    <div className="space-y-2 min-w-fit">
                      {kostenData.map((entry, idx) => (
                        <div key={entry.name} className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                          <span className="text-sm text-gray-700">{entry.name}</span>
                          <span className="text-sm font-semibold text-gray-900 ml-auto">{entry.value.toFixed(2)} €</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default CommuteCostCalculator;
