// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ChipToken is ERC20, Ownable {
    uint256 public constant CHIP_PER_MON = 1000; // 1 MON = 1000 CHIP
    uint256 public constant MIN_DEPOSIT = 0.1 ether; // 0.1 MON minimum deposit
    
    event ChipsPurchased(address indexed buyer, uint256 monAmount, uint256 chipAmount);
    
    constructor(address initialOwner, uint256 initialSupply)
        ERC20("Chip Token", "CHIP")
        Ownable(initialOwner)
    {
        if (initialOwner == address(0)) {
            revert("Invalid owner");
        }
        if (initialSupply > 0) {
            _mint(initialOwner, initialSupply);
        }
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    // Kullanıcılar MON karşılığında CHIP satın alabilir
    function buyChips() external payable {
        require(msg.value >= MIN_DEPOSIT, "Minimum deposit is 0.1 MON");
        
        // Debug: Hesaplama detaylarını logla
        uint256 msgValue = msg.value;
        uint256 chipPerMon = CHIP_PER_MON;
        uint256 oneEther = 1 ether;
        
        // 1 MON = 1000 CHIP, 0.1 MON = 100 CHIP
        // msg.value is in wei (18 decimals), CHIP_PER_MON is 1000
        // Doğru hesaplama: msg.value * 1000 / 1e18
        uint256 chipAmount = (msgValue * chipPerMon) / oneEther;
        
        // Debug event - hesaplama detaylarını göster
        emit ChipsPurchased(msg.sender, msgValue, chipAmount);
        
        require(chipAmount > 0, "Invalid chip amount");
        
        // CHIP token'ı 18 decimal ile mint et
        uint256 chipAmountWithDecimals = chipAmount * (10**18);
        _mint(msg.sender, chipAmountWithDecimals);
    }
    
    // Owner MON'u çekebilir
    function withdrawMon() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No MON to withdraw");
        
        payable(owner()).transfer(balance);
    }
}
