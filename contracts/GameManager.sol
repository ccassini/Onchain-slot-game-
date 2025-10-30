// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GameManager is Ownable, ReentrancyGuard {
    IERC20 public immutable chipToken;

    uint256 public constant BASIS_POINTS = 1_000_000; // 100% expressed in 1e6 precision
    uint256 public constant MAX_PAYOUT_BPS = 10_000_000; // 1000%
    uint256 public constant EXPECTATION_TOLERANCE_BPS = 10_000; // 1% tolerance on expected payout

    mapping(bytes32 => uint256) private _scenarioPayoutBps;
    mapping(bytes32 => bool) private _scenarioExists;

    event ScenarioPayoutUpdated(bytes32 indexed scenarioId, uint256 payoutBps);
    event ScenarioPlayed(address indexed player, bytes32 indexed scenarioId, uint256 betAmount, uint256 payout);
    event BankrollWithdrawn(address indexed to, uint256 amount);

    constructor(address initialOwner, address chipTokenAddress) Ownable(initialOwner) {
        require(initialOwner != address(0), "Invalid owner");
        require(chipTokenAddress != address(0), "Invalid CHIP token");
        chipToken = IERC20(chipTokenAddress);
    }

    function getScenarioPayout(bytes32 scenarioId) external view returns (uint256) {
        return _scenarioPayoutBps[scenarioId];
    }

    function setScenarioPayout(bytes32 scenarioId, uint256 payoutBps) external onlyOwner {
        require(payoutBps <= MAX_PAYOUT_BPS, "Payout too high");
        _scenarioPayoutBps[scenarioId] = payoutBps;
        _scenarioExists[scenarioId] = true;
        emit ScenarioPayoutUpdated(scenarioId, payoutBps);
    }

    function batchSetScenarioPayout(bytes32[] calldata scenarioIds, uint256[] calldata payoutBps) external onlyOwner {
        require(scenarioIds.length == payoutBps.length, "Length mismatch");
        for (uint256 i = 0; i < scenarioIds.length; i++) {
            require(payoutBps[i] <= MAX_PAYOUT_BPS, "Payout too high");
            _scenarioPayoutBps[scenarioIds[i]] = payoutBps[i];
            _scenarioExists[scenarioIds[i]] = true;
            emit ScenarioPayoutUpdated(scenarioIds[i], payoutBps[i]);
        }
    }

    function play(bytes32 scenarioId, uint256 betAmount, uint256 expectedPayout) external nonReentrant returns (uint256) {
        require(betAmount > 0, "Bet must be > 0");

        require(_scenarioExists[scenarioId], "Scenario not configured");
        uint256 payoutBps = _scenarioPayoutBps[scenarioId];

        require(chipToken.transferFrom(msg.sender, address(this), betAmount), "Bet transfer failed");

        uint256 payout = (betAmount * payoutBps) / BASIS_POINTS;

        if (expectedPayout > 0) {
            uint256 tolerance = (payout * EXPECTATION_TOLERANCE_BPS) / BASIS_POINTS;
            uint256 lowerBound = payout > tolerance ? payout - tolerance : 0;
            uint256 upperBound = payout + tolerance;
            require(expectedPayout >= lowerBound && expectedPayout <= upperBound, "Expected payout mismatch");
        }

        if (payout > 0) {
            require(chipToken.balanceOf(address(this)) >= payout, "Insufficient bankroll");
            require(chipToken.transfer(msg.sender, payout), "Payout transfer failed");
        }

        emit ScenarioPlayed(msg.sender, scenarioId, betAmount, payout);
        return payout;
    }

    function withdrawBankroll(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(chipToken.transfer(to, amount), "Withdraw failed");
        emit BankrollWithdrawn(to, amount);
    }
}
