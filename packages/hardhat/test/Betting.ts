import { expect } from "chai";
import { ethers } from "hardhat";
import { Betting } from "../typechain-types";

describe("Betting Contract (Isolated Tests)", function () {
  let betting: Betting;
  let owner: any;
  let user1: any;
  let user2: any;

  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();
  });

  beforeEach(async () => {
    const bettingFactory = await ethers.getContractFactory("Betting");
    betting = (await bettingFactory.deploy()) as Betting;
    await betting.waitForDeployment();
  });

  describe("Event Creation", function () {
    it("Should allow the owner to create a betting event", async function () {
      const tx = await betting.createEvent("Presidential Election", 3);
      await tx.wait();
      const event = await betting.events(0);

      expect(event.name).to.equal("Presidential Election");
      expect(event.numCandidates).to.equal(3);
      expect(event.isOpen).to.equal(true);
    });

    it("Should increment event count after creating a new event", async function () {
      await betting.createEvent("Event One", 2);
      await betting.createEvent("Event Two", 2);
      expect(await betting.eventCount()).to.equal(2);
    });
  });

  describe("getEventTotalBetsOnCandidate", function () {
    it("Should return an array of total bets for all candidates in an event", async function () {
      await betting.connect(owner).createEvent("Candidate Bets Test", 3);

      const betAmount1 = ethers.parseEther("1");
      const betAmount2 = ethers.parseEther("2");
      const betAmount3 = ethers.parseEther("3");

      await betting.connect(user1).placeBet(0, 0, { value: betAmount1 });
      await betting.connect(user2).placeBet(0, 1, { value: betAmount2 });
      await betting.connect(owner).placeBet(0, 2, { value: betAmount3 });

      const totalBets = await betting.getEventTotalBetsOnCandidate(0);

      expect(totalBets[0]).to.equal(betAmount1);
      expect(totalBets[1]).to.equal(betAmount2);
      expect(totalBets[2]).to.equal(betAmount3);
    });

    it("Should return an array of zeros if no bets are placed", async function () {
      await betting.connect(owner).createEvent("Empty Bets Event", 3);

      const totalBets = await betting.getEventTotalBetsOnCandidate(0);

      expect(totalBets.length).to.equal(3);
      expect(totalBets[0]).to.equal(0);
      expect(totalBets[1]).to.equal(0);
      expect(totalBets[2]).to.equal(0);
    });

    it("Should reject if event does not exist", async function () {
      await expect(betting.getEventTotalBetsOnCandidate(999)).to.be.revertedWith("Event does not exist");
    });
  });

  describe("Betting", function () {
    it("Should allow a user to place a bet", async function () {
      await betting.connect(owner).createEvent("Some Event", 3);
      const betAmount = ethers.parseEther("1");

      const tx = await betting.connect(user1).placeBet(0, 1, { value: betAmount });
      await tx.wait();

      const userBet = await betting.getUserBet(0, user1.address);
      const totalBetOnCandidate = await betting.getTotalBetsOnCandidate(0, 1);

      expect(userBet.amount).to.equal(betAmount);
      expect(totalBetOnCandidate).to.equal(betAmount);
    });

    it("Should reject bets on invalid candidates", async function () {
      await betting.connect(owner).createEvent("Some Event", 3);
      const betAmount = ethers.parseEther("1");

      await expect(betting.connect(user1).placeBet(0, 5, { value: betAmount })).to.be.revertedWith("Invalid candidate");
    });

    it("Should reject bets when betting is closed", async function () {
      await betting.connect(owner).createEvent("Some Event", 3);
      await betting.connect(owner).closeBetting(0);
      const betAmount = ethers.parseEther("1");

      await expect(betting.connect(user1).placeBet(0, 1, { value: betAmount })).to.be.revertedWith("Betting is closed");
    });

    it("Should reject multiple bets by the same user on the same event", async function () {
      await betting.connect(owner).createEvent("Some Event", 3);
      const betAmount = ethers.parseEther("1");

      await betting.connect(user1).placeBet(0, 1, { value: betAmount });

      await expect(betting.connect(user1).placeBet(0, 2, { value: betAmount })).to.be.revertedWith("Already bet");
    });
  });

  describe("Resolving Events", function () {
    it("Should allow the event creator to resolve an event", async function () {
      await betting.connect(owner).createEvent("Some Event", 3);
      await betting.connect(owner).closeBetting(0);

      const tx = await betting.connect(owner).resolveEvent(0, 1);
      await tx.wait();

      const resolvedEvent = await betting.events(0);
      expect(resolvedEvent.resolved).to.equal(true);
      expect(resolvedEvent.winner).to.equal(1);
    });

    it("Should reject resolving an already resolved event", async function () {
      await betting.connect(owner).createEvent("Some Event", 3);
      await betting.connect(owner).closeBetting(0);
      await betting.connect(owner).resolveEvent(0, 1);

      await expect(betting.connect(owner).resolveEvent(0, 1)).to.be.revertedWith("Already resolved");
    });

    it("Should reject resolving an event by a non-owner", async function () {
      await betting.connect(owner).createEvent("Some Event", 3);
      await betting.connect(owner).closeBetting(0);

      await expect(betting.connect(user1).resolveEvent(0, 1)).to.be.revertedWith("Not event creator");
    });
  });

  describe("Claiming Winnings", function () {
    it("Should allow a winning user to claim winnings", async function () {
      await betting.connect(owner).createEvent("Some Event", 2);
      const betAmount = ethers.parseEther("1");

      await betting.connect(user1).placeBet(0, 0, { value: betAmount });
      await betting.connect(user2).placeBet(0, 1, { value: betAmount });

      await betting.connect(owner).closeBetting(0);
      await betting.connect(owner).resolveEvent(0, 0);

      const initialBalance = await ethers.provider.getBalance(user1.address);
      const claimTx = await betting.connect(user1).claimWinnings(0);
      const receipt = await claimTx.wait();

      if (!receipt) {
        throw new Error("Transaction receipt is null");
      }

      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const finalBalance = await ethers.provider.getBalance(user1.address);
      const winnings = ethers.parseEther("2");

      expect(finalBalance).to.equal(initialBalance + winnings - gasUsed);
    });

    it("Should reject claims from non-winning users", async function () {
      await betting.connect(owner).createEvent("Some Event", 2);
      const betAmount = ethers.parseEther("1");

      await betting.connect(user1).placeBet(0, 0, { value: betAmount });
      await betting.connect(user2).placeBet(0, 1, { value: betAmount });

      await betting.connect(owner).closeBetting(0);
      await betting.connect(owner).resolveEvent(0, 0);

      await expect(betting.connect(user2).claimWinnings(0)).to.be.revertedWith("Not a winner");
    });

    it("Should reject claims on unresolved events", async function () {
      await betting.connect(owner).createEvent("Not resolved event", 3);
      await expect(betting.connect(user1).claimWinnings(0)).to.be.revertedWith("Not resolved");
    });
  });
});
