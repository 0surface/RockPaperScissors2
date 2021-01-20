// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

/**
 * @title Ownable
 * @dev Set & change owner
 */
contract Ownable {
    address private owner;

    event LogOwnerChanged(address indexed oldOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not owner");
        _;
    }

     /**
     * @dev Set contract deployer as owner
     */
    constructor() public  {
        owner = msg.sender; // 'msg.sender' is sender of current call, contract deployer for a constructor
        emit LogOwnerChanged(address(0), owner);
    }
    
      /**
     * @dev Change owner
     * @param newOwner address of new owner
     */
    function changeOwner(address newOwner) public onlyOwner {     
        require(newOwner != address(0), "Can't assign ownership to null address");
        owner = newOwner;
        emit LogOwnerChanged(owner, newOwner);
    }

}