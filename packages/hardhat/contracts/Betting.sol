// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

contract Betting {
    struct Bet {
        uint8 candidate;
        uint256 amount;
    }

    struct Event {
        address creator;
        string name;
        uint8 numCandidates;
        bool isOpen;
        bool resolved;
        uint8 winner;
        uint256[] totalBetsOnCandidate;
        mapping(address => Bet) bets;
    }

    uint256 public eventCount = 0;
    mapping(uint256 => Event) public events;

    modifier onlyCreator(uint256 eventId) {
        require(events[eventId].creator == msg.sender, "Not event creator");
        _;
    }

    modifier eventExists(uint256 eventId) {
        require(eventId < eventCount, "Event does not exist");
        _;
    }

    function getEventTotalBetsOnCandidate(uint256 eventId) external view eventExists(eventId) returns (uint256[] memory) {
        return events[eventId].totalBetsOnCandidate;
    }

    function createEvent(string memory name, uint8 numCandidates) external returns (uint256) {
        require(numCandidates > 1, "Must have at least 2 candidates");

        Event storage newEvent = events[eventCount];
        newEvent.creator = msg.sender;
        newEvent.name = name;
        newEvent.numCandidates = numCandidates;
        newEvent.isOpen = true;
        newEvent.resolved = false;
        newEvent.totalBetsOnCandidate = new uint256[](numCandidates);

        eventCount++;
        return eventCount - 1;
    }

    function placeBet(uint256 eventId, uint8 candidate) external payable eventExists(eventId) {
        Event storage betEvent = events[eventId];
        require(betEvent.isOpen, "Betting is closed");
        require(candidate < betEvent.numCandidates, "Invalid candidate");
        require(msg.value > 0, "Bet must be > 0");
        require(betEvent.bets[msg.sender].amount == 0, "Already bet");

        betEvent.bets[msg.sender] = Bet(candidate, msg.value);
        betEvent.totalBetsOnCandidate[candidate] += msg.value;
    }

    function closeBetting(uint256 eventId) external onlyCreator(eventId) eventExists(eventId) {
        Event storage betEvent = events[eventId];
        require(betEvent.isOpen, "Already closed");
        betEvent.isOpen = false;
    }

    function resolveEvent(uint256 eventId, uint8 _winner) external onlyCreator(eventId) eventExists(eventId) {
        Event storage betEvent = events[eventId];
        require(!betEvent.resolved, "Already resolved");
        require(!betEvent.isOpen, "Betting still open");
        require(_winner < betEvent.numCandidates, "Invalid winner");
        betEvent.winner = _winner;
        betEvent.resolved = true;
    }

    function claimWinnings(uint256 eventId) external eventExists(eventId) {
        Event storage betEvent = events[eventId];
        require(betEvent.resolved, "Not resolved");

        Bet storage userBet = betEvent.bets[msg.sender];
        require(userBet.amount > 0, "No bet");
        require(userBet.candidate == betEvent.winner, "Not a winner");

        uint256 userBetAmount = userBet.amount;
        uint256 totalWinning = betEvent.totalBetsOnCandidate[betEvent.winner];
        uint256 totalLosing = 0;

        for (uint8 i = 0; i < betEvent.numCandidates; i++) {
            if (i != betEvent.winner) {
                totalLosing += betEvent.totalBetsOnCandidate[i];
            }
        }

        userBet.amount = 0;
        uint256 winnings = userBetAmount + (userBetAmount * totalLosing) / totalWinning;
        payable(msg.sender).transfer(winnings);
    }

    function getUserBet(
        uint256 eventId,
        address user
    ) external view eventExists(eventId) returns (uint8 candidate, uint256 amount) {
        Bet storage userBet = events[eventId].bets[user];
        return (userBet.candidate, userBet.amount);
    }

    function getTotalBetsOnCandidate(
        uint256 eventId,
        uint8 candidate
    ) external view eventExists(eventId) returns (uint256) {
        require(candidate < events[eventId].numCandidates, "Invalid candidate");
        return events[eventId].totalBetsOnCandidate[candidate];
    }

    receive() external payable {}
}