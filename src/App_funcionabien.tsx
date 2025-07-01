import React, { useState, useMemo, useRef } from 'react';
import ReactFlow, { Background, Controls, MiniMap, Node, Edge } from 'reactflow';
import { v4 as uuidv4 } from 'uuid';
import 'reactflow/dist/style.css';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { motion } from 'framer-motion';

import bgIngreso from './img/angaLogo.jpg';
import bgTorneo from './img/angaLogo.jpg';

interface Match {
  id: string;
  p1: string;
  p2: string;
  winner: string | null;
  round: number;
  parents: string[];
}

const TrophyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="gold"
    viewBox="0 0 24 24"
    stroke="goldenrod"
    strokeWidth={1.5}
    className="w-10 h-10 mx-auto mb-2"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8 7V5a4 4 0 014-4 4 4 0 014 4v2a6 6 0 01-8 5.916V17a1 1 0 11-2 0v-4.084A6 6 0 018 7z"
    />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v2" />
  </svg>
);

const fireworkVariants = {
  hidden: { opacity: 0, scale: 0 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    x: Math.cos(i * (Math.PI * 2 / 8)) * 25,
    y: Math.sin(i * (Math.PI * 2 / 8)) * 25,
    transition: {
      delay: i * 0.05,
      yoyo: Infinity,
      duration: 0.8,
      ease: "easeInOut",
    },
  }),
};

export default function App() {
  const [players, setPlayers] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [started, setStarted] = useState(false);
  const flowRef = useRef<HTMLDivElement>(null);

  const addPlayer = () => {
    if (input.trim()) {
      setPlayers((prev) => [...prev, input.trim()]);
      setInput('');
    }
  };

  const shufflePlayers = () => {
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    setPlayers(shuffled);
  };

  const generateInitialMatches = (playersList: string[]): Match[] => {
    const currentPlayers = [...playersList];
    const matches: Match[] = [];

    while (currentPlayers.length % 2 !== 0) {
      currentPlayers.push('Libre');
    }

    for (let i = 0; i < currentPlayers.length; i += 2) {
      matches.push({
        id: uuidv4(),
        p1: currentPlayers[i],
        p2: currentPlayers[i + 1],
        winner: null,
        round: 0,
        parents: []
      });
    }

    return matches;
  };

  const generateNextRound = (currentMatches: Match[]): Match[] => {
    const nextRound: Match[] = [];

    for (let i = 0; i < currentMatches.length; i += 2) {
      const m1 = currentMatches[i];
      const m2 = currentMatches[i + 1];
      nextRound.push({
        id: uuidv4(),
        p1: m1?.winner || 'Pendiente',
        p2: m2?.winner || 'Pendiente',
        winner: null,
        round: m1.round + 1,
        parents: [m1.id, m2?.id || '']
      });
    }

    return nextRound;
  };

  const handleLibreChange = (matchId: string, value: string, playerNumber: 1 | 2) => {
    setMatches(prev =>
      prev.map(m =>
        m.id === matchId
          ? { ...m, [playerNumber === 1 ? 'p1' : 'p2']: value }
          : m
      )
    );
  };

  const startTournament = () => {
    const initialMatches = generateInitialMatches(players);
    setMatches(initialMatches);
    setStarted(true);
  };

  const handleWinner = (matchId: string, winner: string) => {
    let updated = matches.map((m) => m.id === matchId ? { ...m, winner } : m);
    const currentMatch = updated.find((m) => m.id === matchId);
    if (!currentMatch) return;

    const currentRoundMatches = updated.filter(m => m.round === currentMatch.round);
    const allWinnersSelected = currentRoundMatches.every(m => m.winner);
    const nextRoundExists = updated.some(m => m.round === currentMatch.round + 1);

    const isLastMatch = currentRoundMatches.length === 1 && !nextRoundExists;

    if (allWinnersSelected && !nextRoundExists && !isLastMatch) {
      const nextRoundMatches = generateNextRound(currentRoundMatches);
      updated = [...updated, ...nextRoundMatches];
    }

    setMatches(updated);
  };

  const nodes: Node[] = useMemo(() => {
    const nodesArray: Node[] = [];
    const spacingX = 250;
    const spacingY = 160;
    const rounds = Math.max(...matches.map((m) => m.round), 0);

    for (let round = 0; round <= rounds; round++) {
      const roundMatches = matches.filter((m) => m.round === round);
      const offsetY = (spacingY * roundMatches.length) / -2;
      roundMatches.forEach((match, idx) => {
        const winnerSelected = !!match.winner;
        nodesArray.push({
          id: match.id,
          position: {
            x: round * spacingX,
            y: idx * spacingY + offsetY,
          },
          data: {
            label: (
              <div className={`flex flex-col gap-2 text-sm bg-white border rounded-xl p-3 min-w-[160px] ${winnerSelected ? 'border-green-500 shadow-green-300 shadow-lg' : 'shadow-md'}`}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={match.winner === match.p1}
                    onChange={() => handleWinner(match.id, match.p1 ?? '')}
                  />
                  <input
                    className="border px-1 py-0.5 text-xs rounded w-full"
                    value={match.p1 ?? ''}
                    onChange={(e) => handleLibreChange(match.id, e.target.value, 1)}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={match.winner === match.p2}
                    onChange={() => handleWinner(match.id, match.p2 ?? '')}
                  />
                  <input
                    className="border px-1 py-0.5 text-xs rounded w-full"
                    value={match.p2 ?? ''}
                    onChange={(e) => handleLibreChange(match.id, e.target.value, 2)}
                  />
                </label>
                {match.winner && (
                  <div className="text-green-600 font-semibold text-center pt-1 border-t mt-2">
                    Ganador: {match.winner}
                  </div>
                )}
              </div>
            ),
          },
          type: 'default',
        });
      });
    }

    const finalRound = Math.max(...matches.map(m => m.round), 0);
    const finalMatches = matches.filter(m => m.round === finalRound);
    const finalMatch = finalMatches.length === 1 ? finalMatches[0] : null;
    const noMoreRounds = !matches.some(m => m.round > finalRound);
    const allWinnersSelected = matches.length > 0 && matches.every(m => !!m.winner);

    if (finalMatch && finalMatch.winner && noMoreRounds && allWinnersSelected) {
      const maxX = Math.max(...nodesArray.map((n) => n.position.x));
      const rightMostNodes = nodesArray.filter((n) => n.position.x === maxX);
      const avgY = rightMostNodes.reduce((sum, n) => sum + n.position.y, 0) / rightMostNodes.length;

      nodesArray.push({
        id: 'winner-node',
        position: { x: maxX + spacingX, y: avgY },
        data: {
          label: (
            <motion.div
              className="bg-yellow-100 text-blue-700 text-center p-4 rounded-xl font-bold shadow relative overflow-visible border border-yellow-400"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.6, type: 'spring', bounce: 0.3 }}
            >
              <TrophyIcon />
              GANADOR: {finalMatch.winner}

              <div className="absolute inset-0 pointer-events-none overflow-visible">
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    custom={i}
                    variants={fireworkVariants}
                    initial="hidden"
                    animate="visible"
                    className="w-3 h-3 rounded-full bg-yellow-400 absolute top-1/2 left-1/2"
                    style={{ originX: 0.5, originY: 0.5 }}
                  />
                ))}
              </div>
            </motion.div>
          ),
        },
        type: 'default',
        draggable: false,
      });
    }

    return nodesArray;
  }, [matches]);

  const edges: Edge[] = useMemo(() => {
    const allEdges: Edge[] = [];
    matches.forEach((match) => {
      match.parents.forEach((parentId) => {
        if (parentId)
          allEdges.push({
            id: `e-${parentId}-${match.id}`,
            source: parentId,
            target: match.id,
            type: 'smoothstep',
            animated: true,
          });
      });
    });

    const finalRound = Math.max(...matches.map(m => m.round), 0);
    const finalMatches = matches.filter(m => m.round === finalRound);
    const finalMatch = finalMatches.length === 1 ? finalMatches[0] : null;
    const noMoreRounds = !matches.some(m => m.round > finalRound);
    const allWinnersSelected = matches.length > 0 && matches.every(m => !!m.winner);

    if (finalMatch && finalMatch.winner && noMoreRounds && allWinnersSelected) {
      allEdges.push({
        id: 'e-final-winner',
        source: finalMatch.id,
        target: 'winner-node',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#3b82f6', strokeWidth: 3 },
      });
    }

    return allEdges;
  }, [matches]);

  const exportPDF = async () => {
    if (!flowRef.current) return;
    const canvas = await html2canvas(flowRef.current);
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('landscape');
    const imgProps = pdf.getImageProperties(imgData);
    const width = pdf.internal.pageSize.getWidth();
    const height = (imgProps.height * width) / imgProps.width;
    pdf.addImage(imgData, 'PNG', 0, 0, width, height);
    pdf.save('torneo.pdf');
  };

  return (
    <div className="min-h-screen relative bg-gray-50 overflow-hidden">
      {!started && (
        <div
          className="fixed inset-0 -z-10 bg-cover bg-center filter brightness-75"
          style={{ backgroundImage: `url(${bgIngreso})` }}
          aria-hidden="true"
        />
      )}

      {started && (
        <div
          className="fixed inset-0 -z-10 bg-cover bg-center filter brightness-60"
          style={{ backgroundImage: `url(${bgTorneo})` }}
          aria-hidden="true"
        />
      )}

      {!started ? (
        <div className="flex flex-col gap-4 p-4 max-w-xl mx-auto relative z-10">
          <h1 className="text-2xl font-bold text-white drop-shadow-lg">Cuadro de Eliminación</h1>
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded px-2 py-1"
              placeholder="Nombre del jugador"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
            />
            <button className="bg-blue-500 text-white px-3 py-1 rounded" onClick={addPlayer}>
              Agregar
            </button>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-white drop-shadow-md">
            {players.map((p, i) => (
              <li key={i} className="text-sm">{p}</li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              className="bg-yellow-600 text-white px-4 py-2 rounded"
              onClick={shufflePlayers}
            >
              Aleatorizar jugadores
            </button>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
              onClick={startTournament}
              disabled={players.length < 2}
            >
              Iniciar Torneo
            </button>
          </div>
        </div>
      ) : (
        <div className="h-[90vh] relative z-10">
          <div className="absolute right-4 top-4 z-50">
            <button
              onClick={exportPDF}
              className="bg-purple-500 text-white px-4 py-2 rounded shadow"
            >
              Exportar a PDF
            </button>
          </div>
          <div ref={flowRef} className="h-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              nodesDraggable={true}
              nodesConnectable={false}
              elementsSelectable={true}
              snapToGrid={true}
              snapGrid={[15, 15]}
            >
              <MiniMap />
              <Controls />
              <Background />
            </ReactFlow>
          </div>
        </div>
      )}
    </div>
  );
}
