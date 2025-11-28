import React, { useState, useEffect } from 'react';
import { Calendar, Car, Users, Trash2, Plus, TrendingUp, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from './supabase';

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
      } catch (err) {
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
    } catch (err) {
      alert('Fehler beim Erstellen des Autos');
    }
  };

  const deleteCar = async (id: number) => {
    try {
      const { error } = await supabase.from('cars').delete().eq('id', id);
      if (error) throw error;
      setCars(cars.filter(c => c.id !== id));
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
        if (car) {
          totalCarCost += tripType === 'roundtrip' ? car.roundtripCost : (car.roundtripCost / 2);
        }
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
    } catch (err) {
      alert('Fehler beim Erstellen der Fahrt');
    }
  };

  const deleteCommute = async (id: number) => {
    try {
      const { error } = await supabase.from('commutes').delete().eq('id', id);
      if (error) throw error;
      setCommutes(commutes.filter(c => c.id !== id));
    } catch (err) {
      alert('Fehler beim Löschen der Fahrt');
    }
  };

  const calculateSettlements = (month: string) => {
    const monthCommutes = commutes.filter(c => {
      const commuteMonth = c.date.substring(0, 7);
      return commuteMonth === month;
    });

    const debts: Record<string, Record<string, number>> = {};

    monthCommutes.forEach(commute => {
      const passengers = commute.selectedPersons.filter(id => !commute.drivers.includes(id));
      const driverNames = commute.drivers.map(id => persons.find(p => p.id === id)?.name).filter((name): name is string => name !== undefined);
      
      passengers.forEach(passengerId => {
        const passenger = persons.find(p => p.id === passengerId);
        if (!passenger) return;
        
        if (!debts[passenger.name]) debts[passenger.name] = {};
        
        const amountPerDriver = commute.pricePerPerson / driverNames.length;
        
        driverNames.forEach(driverName => {
          if (!debts[passenger.name][driverName]) {
            debts[passenger.name][driverName] = 0;
          }
          debts[passenger.name][driverName] += amountPerDriver;
        });
      });
    });

    const netDebts: Record<string, Record<string, number>> = {};
    Object.keys(debts).forEach(person1 => {
      Object.keys(debts[person1]).forEach(person2 => {
        const debt1to2 = debts[person1]?.[person2] || 0;
        const debt2to1 = debts[person2]?.[person1] || 0;
        
        if (debt1to2 > debt2to1) {
          if (!netDebts[person1]) netDebts[person1] = {};
          netDebts[person1][person2] = debt1to2 - debt2to1;
        }
      });
    });

    return { debts, netDebts };
  };

  const getMonths = (): string[] => {
    const months: string[] = Array.from(new Set(commutes.map(c => c.date.substring(0, 7))));
    return months.sort().reverse();
  };

  const getOwnerName = (ownerId: number) => {
    return persons.find(p => p.id === ownerId)?.name || 'Unbekannt';
  };

  const downloadMonthlyReport = (month: string) => {
    const { debts, netDebts } = calculateSettlements(month);
    const [year, monthNum] = month.split('-');
    const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('de-DE', { 
      month: 'long', 
      year: 'numeric' 
    });

    let csv = `Abrechnung ${monthName}\n\n`;
    
    csv += 'Gesamtübersicht\n';
    csv += 'Von,An,Betrag\n';
    Object.keys(debts).forEach(passenger => {
      Object.keys(debts[passenger]).forEach(driver => {
        csv += `${passenger},${driver},${debts[passenger][driver].toFixed(2)}€\n`;
      });
    });
    
    csv += '\nNetto-Abrechnung (nach Verrechnung)\n';
    csv += 'Von,An,Betrag\n';
    Object.keys(netDebts).forEach(person1 => {
      Object.keys(netDebts[person1]).forEach(person2 => {
        csv += `${person1},${person2},${netDebts[person1][person2].toFixed(2)}€\n`;
      });
    });

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
          <button
            onClick={loadData}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
            <Car className="text-blue-600" />
            Pendel-Kostenrechner
          </h1>
          <button
            onClick={loadData}
            className="text-gray-600 hover:text-blue-600 p-2"
            title="Daten aktualisieren"
          >
            <RefreshCw size={20} />
          </button>
        </div>

        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b flex-wrap">
            <button
              onClick={() => setActiveTab('commutes')}
              className={`flex-1 px-6 py-3 font-medium min-w-fit ${
                activeTab === 'commutes'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600'
              }`}
            >
              <Calendar className="inline mr-2" size={18} />
              Fahrten
            </button>
            <button
              onClick={() => setActiveTab('cars')}
              className={`flex-1 px-6 py-3 font-medium min-w-fit ${
                activeTab === 'cars'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600'
              }`}
            >
              <Car className="inline mr-2" size={18} />
              Autos
            </button>
            <button
              onClick={() => setActiveTab('persons')}
              className={`flex-1 px-6 py-3 font-medium min-w-fit ${
                activeTab === 'persons'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600'
              }`}
            >
              <Users className="inline mr-2" size={18} />
              Personen
            </button>
            <button
              onClick={() => setActiveTab('settlements')}
              className={`flex-1 px-6 py-3 font-medium min-w-fit ${
                activeTab === 'settlements'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600'
              }`}
            >
              <TrendingUp className="inline mr-2" size={18} />
              Abrechnungen
            </button>
          </div>
        </div>

        {activeTab === 'cars' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Autos verwalten</h2>
            <div className="grid grid-cols-1 gap-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="text"
                  placeholder="Auto Name (z.B. BMW X5)"
                  value={newCar.name}
                  onChange={(e) => setNewCar({ ...newCar, name: e.target.value })}
                  className="border rounded px-3 py-2"
                />
                <select
                  value={newCar.ownerId}
                  onChange={(e) => setNewCar({ ...newCar, ownerId: e.target.value })}
                  className="border rounded px-3 py-2"
                >
                  <option value="">Besitzer wählen...</option>
                  {persons.map(person => (
                    <option key={person.id} value={person.id}>{person.name}</option>
                  ))}
                  <option value="new">+ Neue Person erstellen</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Kosten Hin & Rück (€)"
                  value={newCar.roundtripCost}
                  onChange={(e) => setNewCar({ ...newCar, roundtripCost: e.target.value })}
                  className="border rounded px-3 py-2"
                />
                <button
                  onClick={addCar}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 justify-center"
                >
                  <Plus size={18} />
                  Hinzufügen
                </button>
              </div>
              {newCar.ownerId === 'new' && (
                <input
                  type="text"
                  placeholder="Name der neuen Person"
                  value={newCar.newOwnerName}
                  onChange={(e) => setNewCar({ ...newCar, newOwnerName: e.target.value })}
                  className="border rounded px-3 py-2 border-blue-400"
                />
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
                  <button
                    onClick={() => deleteCar(car.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'persons' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Personen verwalten</h2>
            <div className="flex gap-4 mb-6 flex-col sm:flex-row">
              <input
                type="text"
                placeholder="Name"
                value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
                className="flex-1 border rounded px-3 py-2"
              />
              <button
                onClick={addPerson}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={18} />
                Hinzufügen
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
                        <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          Autobesitzer
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => deletePerson(person.id)}
                      className="text-red-600 hover:text-red-800"
                      title={ownsCar ? "Person besitzt ein Auto und kann nicht gelöscht werden" : "Person löschen"}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'commutes' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Neue Fahrt erfassen</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Datum</label>
                  <input
                    type="date"
                    value={newCommute.date}
                    onChange={(e) => setNewCommute({ ...newCommute, date: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Fahrttyp</label>
                  <select
                    value={newCommute.tripType}
                    onChange={(e) => setNewCommute({ ...newCommute, tripType: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="oneway">Einfach</option>
                    <option value="roundtrip">Hin & Rück</option>
                  </select>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Autos auswählen (Besitzer = Fahrer)</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {cars.map(car => (
                    <button
                      key={car.id}
                      onClick={() => toggleCarSelection(car.id)}
                      className={`p-3 rounded border-2 text-left ${
                        newCommute.selectedCars.includes(car.id)
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200'
                      }`}
                    >
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
                    <button
                      key={person.id}
                      onClick={() => togglePersonSelection(person.id)}
                      className={`p-3 rounded border-2 ${
                        newCommute.selectedPersons.includes(person.id)
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200'
                      }`}
                    >
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

              <button
                onClick={addCommute}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 font-medium"
              >
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
                        <button
                          onClick={() => deleteCommute(commute.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Autos:</span>{' '}
                          {commute.selectedCars.map(carId => 
                            cars.find(c => c.id === carId)?.name
                          ).join(', ')}
                        </div>
                        <div>
                          <span className="font-medium">Personen:</span>{' '}
                          {commute.selectedPersons.map(pId => 
                            persons.find(p => p.id === pId)?.name
                          ).join(', ')}
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

        {activeTab === 'settlements' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Monatliche Abrechnungen</h2>
            {getMonths().length === 0 ? (
              <p className="text-gray-500 text-center py-8">Noch keine Fahrten zum Abrechnen</p>
            ) : (
              getMonths().map(month => {
                const { debts, netDebts } = calculateSettlements(month);
                const [year, monthNum] = month.split('-');
                const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('de-DE', { 
                  month: 'long', 
                  year: 'numeric' 
                });

                return (
                  <div key={month} className="mb-6 border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
                      <h3 className="text-lg font-semibold capitalize">{monthName}</h3>
                      <button
                        onClick={() => downloadMonthlyReport(month)}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                      >
                        <Download size={18} />
                        CSV Download
                      </button>
                    </div>
                    
                    <div className="mb-4">
                      <h4 className="font-medium mb-2 text-gray-700">Gesamtübersicht:</h4>
                      <div className="space-y-2">
                        {Object.keys(debts).map(passenger => (
                          <div key={passenger}>
                            {Object.keys(debts[passenger]).map(driver => (
                              <div key={`${passenger}-${driver}`} className="text-sm text-gray-600">
                                {passenger} schuldet {driver}: <span className="font-medium text-gray-900">{debts[passenger][driver].toFixed(2)}€</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2 text-gray-700">Netto-Abrechnung (nach Verrechnung):</h4>
                      <div className="space-y-2">
                        {Object.keys(netDebts).length === 0 ? (
                          <div className="text-sm text-gray-600">Alle Schulden sind beglichen.</div>
                        ) : (
                          Object.keys(netDebts).map(person1 => (
                            <div key={person1}>
                              {Object.keys(netDebts[person1]).map(person2 => (
                                <div key={`${person1}-${person2}`} className="text-sm text-gray-600">
                                  {person1} schuldet {person2}: <span className="font-medium text-gray-900">{netDebts[person1][person2].toFixed(2)}€</span>
                                </div>
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommuteCostCalculator;
