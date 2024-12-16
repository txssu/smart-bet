"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { useScaffoldContract } from "~~/hooks/scaffold-eth";

type EventData = {
  eventId: bigint;
  name: string;
  numCandidates: number;
  isOpen: boolean;
  resolved: boolean;
  winner?: number;
  totalBetsOnCandidate: bigint[];
  creator: string;
};

export default function EventsPage() {
  const router = useRouter();
  const { address: connectedAddress } = useAccount();
  const [events, setEvents] = useState<EventData[]>([]);
  const { data: contract, isLoading } = useScaffoldContract({ contractName: "Betting" });

  const loadEventInfo = async (id: bigint) => {
    const eventData = await contract?.read.events([id]);
    if (!eventData) return;

    const [creator, name, numCandidates, isOpen, resolved, winner] = eventData;

    const totalBets = (await contract?.read.getEventTotalBetsOnCandidate([id])) as bigint[];
    return {
      eventId: id,
      name,
      numCandidates,
      isOpen,
      resolved,
      winner: resolved ? winner : undefined,
      totalBetsOnCandidate: totalBets,
      creator,
    };
  };

  const fetchEvents = async () => {
    const eventCount = await contract?.read.eventCount();
    if (!eventCount) return;

    const count = Number(eventCount);
    const promises = [];
    for (let i = count - 1; i >= 0; i--) {
      promises.push(loadEventInfo(BigInt(i)));
    }
    const result = await Promise.all(promises);
    setEvents(result.filter(Boolean) as EventData[]);
  };

  useEffect(() => {
    if (isLoading) return;
    fetchEvents();

    const interval = setInterval(() => {
      fetchEvents();
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Betting DApp</h1>
      <div className="flex gap-4 mb-4">
        <p>Connected address:</p>
        <Address address={connectedAddress} />
      </div>
      <div className="mb-4">
        <button className="btn btn-primary" onClick={() => router.push("/events/create")}>
          Create New Event
        </button>
      </div>
      <div className="border p-4">
        <h2 className="text-xl font-semibold mb-2">Events</h2>
        {events.length === 0 && <p>No events yet.</p>}
        {events.map(ev => (
          <div key={ev.eventId.toString()} className="p-4 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold">
                  Event #{ev.eventId.toString()}: {ev.name}
                </p>
                <p>
                  Candidates: {ev.numCandidates} | Open: {ev.isOpen ? "Yes" : "No"} | Resolved:{" "}
                  {ev.resolved ? `Yes (winner: ${ev.winner})` : "No"}
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => router.replace(`/events/${ev.eventId.toString()}`)}>
                View
              </button>
            </div>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                Total bets by candidate:{" "}
                {ev.totalBetsOnCandidate.map((t, i) => `C${i}: ${t.toString()} wei`).join(", ")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
