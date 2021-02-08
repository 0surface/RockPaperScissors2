// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "./Ownable.sol";
import "./SafeMath.sol";

contract RockPaperScissors is Ownable {
    using SafeMath for uint;
    
    struct Game {
        uint stake; 
        uint playDeadline;
        uint revealDeadline;
        bytes32 creatorMaskedChoice;

        address creator;
        Choice creatorChoice;

        address opponent;
        Choice opponentChoice;               
    }
    mapping(bytes32 => Game) public games;
    mapping(address => uint) public winnings;

    enum Choice {NONE, ROCK, PAPER, SCISSORS}
    enum Outcome {NONE, DRAW, WIN, LOSE}

    bytes32 constant public NULL_BYTES = bytes32(0);
    uint constant public MASK_TIMESTAMP_SLACK = 10;
    uint constant public MASK_BLOCK_SLACK = 1;
    uint constant public MIN_STAKE = 1000000000000000; //10e15 wei or 0.001 ETH
    uint constant public MIN_CUTOFF_INTERVAL = 1 minutes;
    uint constant public MAX_CUTOFF_INTERVAL = 10 days;

    event LogGameCreated(bytes32 indexed gameId, address indexed opponent, uint indexed playDeadline, uint staked);
    event LogGamePlayed(bytes32 indexed gameId, address indexed player, Choice choice);    
    event LogWinningsBalanceChanged(address indexed player, uint old, uint latest);
    event LogGameFinished(bytes32 indexed gameId, Outcome indexed outcome, uint stake, address settler);
    event LogWithdrawal(address indexed withdrawer, uint withdrawn);

    constructor() public {} 

    /* @dev creates a masked bytes32 value of the given choice.
          @param maskTimestamp
               Expects the current block.timestamp, give or take  MASK_TIMESTAMP_SLACK seconds.
               This is to strongly discourage reuse of maskTimestamp values.
          @param maskingOnly
               caller must set to true when calling this method.
          @param blockNo
               block number corresponding to the block maskTimestamp is taken from.
     */
    function maskChoice(Choice choice, bytes32 mask, address masker, uint maskTimestamp, bool maskingOnly, uint blockNo) 
     public view 
     returns (bytes32 maskedChoice)
     {
         if(maskingOnly){
            require(choice != Choice.NONE, "RockPaperScissors::maskChoice:game move choice can not be NONE");
            require(mask != NULL_BYTES, "RockPaperScissors::maskChoice:mask can not be empty");
            require(masker != address(0), "RockPaperScissors::maskChoice:masker can not be null address");
            require((block.number).add(MASK_BLOCK_SLACK) >= blockNo && blockNo >= (block.number).sub(MASK_BLOCK_SLACK),"RockPaperScissors::maskChoice:blockNo is invalid");
            require((block.timestamp).sub(MASK_TIMESTAMP_SLACK) <= maskTimestamp, "RockPaperScissors::maskChoice:maskTimestamp below minimum, use latest block timestamp");
            require((block.timestamp).add(MASK_TIMESTAMP_SLACK) >= maskTimestamp, "RockPaperScissors::maskChoice:maskTimestamp above maximum, use latest block timestamp");
        }else{            
            require(block.timestamp >= (maskTimestamp).add(MIN_CUTOFF_INTERVAL), "RockPaperScissors::maskChoice:Invalid maskTimestamp for reveal");
        }
       
        return keccak256(abi.encodePacked(address(this), choice, mask, masker, maskTimestamp));
    } 

    function create(address opponent, bytes32 maskedChoice, uint toStake, uint playCutoffInterval) payable public  {
        require(msg.sender != opponent,"RockPaperScissors::create:game creator and opponenet can not identical");
        require(opponent != address(0),"RockPaperScissors::create:opponent address can not be empty");
        require(maskedChoice != NULL_BYTES,"RockPaperScissors::create:masked choice can not be empty");
        require(toStake >= MIN_STAKE,"RockPaperScissors::create:insufficient stake");
        require(playCutoffInterval >= MIN_CUTOFF_INTERVAL,"RockPaperScissors::create:cutoff interval below minimum");
        require(playCutoffInterval <= MAX_CUTOFF_INTERVAL,"RockPaperScissors::create:cutoff interval above maximum");
        require(games[maskedChoice].playDeadline == 0, "RockPaperScissors::create:game already exists");

        uint balance = winnings[msg.sender]; //SLOAD
        uint newBalance = balance.add(msg.value).sub(toStake, "RockPaperScissors::create:Insuffcient balance to stake"); //SLOAD
        if(balance != newBalance) { 
            winnings[msg.sender] = newBalance; //SSTORE
            emit LogWinningsBalanceChanged(msg.sender, balance, newBalance);
        }

        uint _playDeadline = block.timestamp.add(playCutoffInterval);
        Game storage game = games[maskedChoice];//SSTORE, SLOAD
        game.creator = msg.sender; //SSTORE
        game.stake = toStake; //SSTORE        
        game.creatorMaskedChoice = maskedChoice; //SSTORE
        game.opponent = opponent; //SSTORE        
        game.playDeadline = _playDeadline; //SSTORE
        game.revealDeadline = _playDeadline.add(playCutoffInterval); //SSTORE

        emit LogGameCreated(maskedChoice, opponent, _playDeadline, toStake);         
    }

    function play(bytes32  gameId, Choice choice) payable public  {
        require(Choice.NONE != choice);
        require(msg.sender == games[gameId].opponent); //SLOAD
        require(block.timestamp <= games[gameId].playDeadline); //SLOAD        

        uint balance = winnings[msg.sender]; //SLOAD
        uint newBalance = balance.add(msg.value).sub(games[gameId].stake, "RockPaperScissors::play:Insuffcient balance to stake"); //SLOAD
        if(balance != newBalance) { 
            winnings[msg.sender] = newBalance; //SSTORE
            emit LogWinningsBalanceChanged(msg.sender, balance, newBalance);
        } 
        
        games[gameId].opponentChoice = choice; //SSTORE

        LogGamePlayed(gameId, msg.sender, choice);
    }
    
    function reveal(bytes32  gameId, Choice choice, bytes32 mask, uint maskTimestamp, uint maskBlockNo) public {        
        Game storage game = games[gameId];        
        require(game.opponentChoice != Choice.NONE || block.timestamp > game.playDeadline, "RockPaperScissors::reveal:opponent has not played or playDeadline not expired");
        require(block.timestamp <= game.revealDeadline,"RockPaperScissors::reveal:reveal deadline has expired");
        require(maskChoice(choice, mask, msg.sender, maskTimestamp, false, maskBlockNo) == game.creatorMaskedChoice, "RockPaperScissors::reveal:masked choice does not match");        
  
        finish(gameId, resolve(choice, game.opponentChoice), game.creator, game.opponent, game.stake);
        delete games[gameId];
    }  

    function settle(bytes32  gameId) public  {
        require(block.timestamp > games[gameId].revealDeadline);
        Game storage game = games[gameId];
        finish(gameId, resolve(game.creatorChoice, game.opponentChoice), game.creator, game.opponent, game.stake);// 5 * SLOAD
        delete games[gameId]; 
    }
    
    function finish(bytes32  gameId, Outcome outcome, address creator, address opponent, uint pay) internal  {
        bool isDraw = outcome == Outcome.DRAW;
        bool isNone = outcome == Outcome.NONE;

        pay = (isDraw || isNone) ? pay : pay.add(pay);   
        
        if((isDraw || isNone || outcome == Outcome.WIN) && pay != 0){
            uint creatorBalance = winnings[creator]; //SLOAD
            uint newCreatorBalance = pay.add(creatorBalance);
            winnings[creator] = newCreatorBalance; //SSTORE                
            emit LogWinningsBalanceChanged(creator, creatorBalance, newCreatorBalance);
        }
        if((isDraw || outcome == Outcome.LOSE) && pay != 0){
            uint opponentBalance = winnings[opponent]; //SLOAD
            uint newOpponentBalance = pay.add(opponentBalance);
            winnings[opponent] = newOpponentBalance; //SSTORE
            emit LogWinningsBalanceChanged(opponent, opponentBalance, newOpponentBalance);
        }        

        emit LogGameFinished(gameId, outcome, pay, msg.sender);
    }   

    function resolve(Choice creatorChoice, Choice opponentChoice) public pure returns(Outcome outcome){
        if(creatorChoice != Choice.NONE )
        {
            return opponentChoice != Choice.NONE ? 
                Outcome(SafeMath.mod(uint(creatorChoice).add(3).sub(uint(opponentChoice)), 3).add(1))
               :Outcome.WIN;
        }
        else
        {
            return opponentChoice != Choice.NONE ? 
                Outcome.LOSE
               :Outcome.NONE;
        }
    }

    function withdraw() public {
        uint total = winnings[msg.sender]; //SLOAD
        require(total > 0, "RockPaperScissors::withdraw:No funds to withdraw");
                
        winnings[msg.sender] = 0; //SSTORE 
        emit LogWinningsBalanceChanged(msg.sender, total, 0);
                
        (bool success, ) = (msg.sender).call{value: total}("");        
        require(success, "withdraw failed");
        LogWithdrawal(msg.sender, total);
    }
}