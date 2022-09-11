import React, { useState } from 'react';
import './App.css';
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import WalletLink from "walletlink";
import Web3 from 'web3';
import 'sf-font';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Button, ButtonGroup } from 'react-bootstrap';
import 'react-notifications/lib/notifications.css'
import { NotificationContainer } from 'react-notifications'
import NotificationManager from 'react-notifications/lib/NotificationManager';
import NFT from './NFT';
import NFTABI from './abi/nft.json'
import SEMIABI from './abi/semi.json'
import STAKINGABI from './abi/staking.json'
import { createAlchemyWeb3 } from '@alch/alchemy-web3';
import { getShortAddress } from './utils/getShortAddress';

var account = null;
var contract = null;
var vaultContract = null;
var web3 = null;

const chainId = 3;

const Web3Alc = createAlchemyWeb3("https://eth-rinkeby.alchemyapi.io/v2/8AX5AP2TU6G45ctsOXNt8K4Fz_BkhhZG");

const providerOptions = {
	binancechainwallet: {
		package: true
    },
    walletconnect: {
		package: WalletConnectProvider,
		options: {
		  infuraId: "3cf2d8833a2143b795b7796087fff369"
		}
	},
	walletlink: {
		package: WalletLink, 
		options: {
		  appName: "TRUCK NFT Minter", 
		  infuraId: "3cf2d8833a2143b795b7796087fff369",
		  rpc: "",
		  chainId: chainId, 
		  appLogoUrl: null, 
		  darkMode: true 
		}
	  },
};

const web3Modal = new Web3Modal({
	network: "ropsten",
	theme: "dark",
	cacheProvider: true,
	providerOptions 
});


function App() {
    const expectedBlockTime = 10000;
    const [balance, setBalance] = useState(0);
    const [total, setTotal] = useState(0);
    const [rawEarn, setRawEarn] = useState('0.00');
    const [outValue, setOutValue] = useState(0);
    const [stakedBalance, setStakedBalance] = useState(0);
    const [stakedNFTs, setStakedNFTs] = useState([]);
    const [nfts, setNfts] = useState([])
    const [nftStk, setNftStk] = useState([])
    const [loadingState, setLoadingState] = useState('not-loaded')
    const [walletBtnText, setWalletBtnText] = useState('Connect Wallet');

    const handleNFT = (nftAmount) => {
        setOutValue(nftAmount.target.value);
    }

    const fetchData = async () => {
        document.getElementById('wallet-address').textContent = getShortAddress(account);
        setWalletBtnText(getShortAddress(account));

        contract = new web3.eth.Contract(NFTABI, process.env.REACT_APP_NFT);
        vaultContract = new web3.eth.Contract(STAKINGABI, process.env.REACT_APP_TRUCK_STAKING);

        await verify();       
        await RewardInfo();
        // NFT        
        let config = {'X-API-Key': process.env.REACT_APP_MORALIS_API_KEY, 'accept': 'application/json'};
        const data = await axios.get((process.env.REACT_APP_MORALIS_API + `/nft/${process.env.REACT_APP_NFT}/owners?chain=ropsten&format=decimal`), {headers: config})
        .then(res => {
            const { result } = res.data;
            return result;
        })
        
        const apiCall = await Promise.all( data.map (async i => {
            let item = {
                tokenId: i.token_id,
                holder: i.owner_of,
                wallet: account,
            }
            return item
        }))

        setNfts(apiCall);
        
        const stakedRes = await vaultContract.methods.tokensOfOwner(account).call()
        .then(id => {
            return id;
        })

        const stakes = await Promise.all(stakedRes.map(async i => {
            let stkId = {
                tokenId: i,
            }
            return stkId
        }))

        setNftStk(stakes)
        setLoadingState('loaded')

        setTotal(await contract.methods.totalSupply().call());
        setBalance(await contract.methods.balanceOf(account).call());
    }

    const connectWallet = async () => {
        const provider = await web3Modal.connect();
        web3 = new Web3(provider);
        await provider.send('eth_requestAccounts');
        const accounts = await web3.eth.getAccounts();
        account = accounts[0];
        fetchData();
    }

    const verify = async () => {
        if(!account) {
            NotificationManager.warning('Warning', 'Please Connect Wallet', 3000);
            return;
        }
        setStakedNFTs(await vaultContract.methods.tokensOfOwner(account).call());
        setStakedBalance(Number(await vaultContract.methods.totalStaked().call()));
    }
    
    const enable = async () => {
        if(!account) {
            NotificationManager.warning('Warning', 'Please Connect Wallet', 3000);
            return;
        }
        contract.methods.setApprovalForAll(process.env.REACT_APP_TRUCK_STAKING, true).send({ from: account });
    }
    
    const RewardInfo = async () => {
        if(!account) {
            NotificationManager.warning('Warning', 'Please Connect Wallet', 3000);
            return;
        }
        const res = await vaultContract.methods.tokensOfOwner(account).call()
        const arrayNft = Array.from(res.map(Number));
        const tokenIds = arrayNft.filter(Number);

        let sum = 0;
        tokenIds.forEach( async (id) => {
            let reward = await vaultContract.methods.earningInfo(account, [id]).call();
            const array = Array.from(reward.map(Number));
            const earned = String(array[0]);
            const earnedRwd = Web3.utils.fromWei(earned);
            const rewardX = Number(earnedRwd).toFixed(2);
            const numRwd = Number(rewardX);
            sum += numRwd;
            let formatSum = Number(sum).toFixed(2);
            setRawEarn(formatSum);
        });
    }

    const ClaimIt = async () => {
        if(!account) {
            NotificationManager.warning('Warning', 'Please Connect Wallet', 3000);
            return;
        }
        const res = await vaultContract.methods.tokensOfOwner(account).call();
        const arrayNft = Array.from(res.map(Number));
        const tokenIds = arrayNft.filter(Number);
        await Web3Alc.eth.getMaxPriorityFeePerGas().then((tip) => {
            Web3Alc.eth.getBlock('pending').then((block) => {
                var baseFee = Number(block.baseFeePerGas);
                var maxPriority = Number(tip);
                var maxFee = maxPriority + baseFee;
                tokenIds.forEach(async (id) => {
                    await vaultContract.methods.claim([id])
                    .send({
                        from: account,
                        maxFeePerGas: maxFee,
                        maxPriorityFeePerGas: maxPriority
                    })
                })
            });
        })
    }


    async function UnStakeAll() {
        if(!account) {
            NotificationManager.warning('Warning', 'Please Connect Wallet', 3000);
            return;
        }
        const res = await vaultContract.methods.tokensOfOwner(account).call();
        const arrayNFT = Array.from(res.map(Number));
        const tokenIds = arrayNFT.filter(Number);

        await Web3Alc.eth.getMaxPriorityFeePerGas().then((tip) => {
          Web3Alc.eth.getBlock('pending').then((block) => {
            var baseFee = Number(block.baseFeePerGas);
            var maxPriority = Number(tip);
            var maxFee = maxPriority + baseFee;
            tokenIds.forEach(async (id) => {
              await vaultContract.methods.unstake([id])
                .send({
                  from: account,
                  maxFeePerGas: maxFee,
                  maxPriorityFeePerGas: maxPriority
                })
            })
          });
        })
      }

    // Buy with First CryptoCurrency
    const sleep = (milliseconds) => {
        return new Promise(resolve => setTimeout(resolve, milliseconds))
    }

    async function mint0() {
        if(!account) {
            NotificationManager.warning('Warning', 'Please Connect Wallet', 3000);
            return;
        }

        if(Number(outValue) === 0) {
            NotificationManager.warning('Warning', 'Please Select Number of Token.', 3000);
            return;
        }

        var _pid = "0";
        var erc20address = await contract.methods.getCryptotoken(_pid).call();
        const currency = new web3.eth.Contract(SEMIABI, erc20address);
        var mintRate = await contract.methods.getNFTCost(_pid).call();
        var _mintAmount = Number(outValue);
        var totalAmount = mintRate * _mintAmount;
        await Web3Alc.eth.getMaxPriorityFeePerGas().then((tip) => {
            Web3Alc.eth.getBlock('pending').then((block) => {
                var baseFee = Number(block.baseFeePerGas);
                var maxPriority = Number(tip);
                var maxFee = maxPriority + baseFee;
                currency.methods.approve(process.env.REACT_APP_NFT, String(totalAmount))
                    .send({ from: account })
                    .then(currency.methods.transfer(process.env.REACT_APP_NFT, String(totalAmount))
                    .send({
                        from: account,
                        maxFeePerGas: maxFee,
                        maxPriorityFeePerGas: maxPriority
                    },
                    async function (error, transactionHash) {
                        console.log("Transfer Submitted, Hash: ", transactionHash)
                        
                        let transactionReceipt = null
                        while (transactionReceipt == null) {
                            transactionReceipt = await web3.eth.getTransactionReceipt(transactionHash);
                            await sleep(expectedBlockTime)
                        }
                        window.console = {
                            log: function (str) {
                                var out = document.createElement("div");
                                out.appendChild(document.createTextNode(str));
                                document.getElementById("txout").appendChild(out);
                            }
                        }

                        await contract.methods.mintpid(account, _mintAmount, _pid)
                        .send({
                            from: account,
                            maxFeePerGas: maxFee,
                            maxPriorityFeePerGas: maxPriority
                        });
                        
                        console.log("Transfer Complete", transactionReceipt);
                        
                    }));
            });
        });
    }

    const refreshPage = () => {
        window.location.reload();  
    }

    return (
        <div className="App nftapp">
            <nav className="navbar navbarfont navbarglow navbar-expand-md navbar-dark bg-dark mb-4">
                <div className="container-fluid" style={{ fontFamily: "SF Pro Display" }}>
                    <img src="logo.png" width="7%" alt='logo' />
                    {/* <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarCollapse" aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
                        <span className="navbar-toggler-icon"></span>
                    </button> */}
                    {/* <div className="collapse navbar-collapse" id="navbarCollapse">
                    </div> */}
                </div>
                <div className='px-5'>
                    <input id="connectbtn" type="button" className="connectbutton" onClick={connectWallet} style={{ fontFamily: "SF Pro Display" }} value={walletBtnText} />
                </div>
            </nav>
            <div className='container'>
            <div className='row'>
                <div className='col-lg-3 col-sm-12 mt-3'>
                    <div className='nftminter'>
                        <form>
                            <div className="row pt-3">
                            <div>
                                <h1 className="pt-2" style={{ fontWeight: "30" }}>NFT Minter</h1>
                            </div>
                            <h3>{balance}/{total}</h3>
                            <h6>Your Wallet Address</h6>
                            <div className="pb-3" id='wallet-address' style={{
                                color: "#39FF14",
                                fontWeight: "400",
                                textShadow: "1px 1px 1px black",
                            }}>
                                <label htmlFor='floatingInput'>Please Connect Wallet</label>
                            </div>
                            </div>
                            <div>
                            <label style={{ fontWeight: "300", fontSize: "18px" }}>Select NFT Quantity</label>
                            </div>
                            <ButtonGroup size="lg"
                                aria-label="First group"
                                name="amount"
                                style={{ boxShadow: "1px 1px 5px #000000" }}
                                onClick={e => handleNFT(e, "value")}
                            >
                                <Button value="1">1</Button>
                                <Button value="2">2</Button>
                                <Button value="3">3</Button>
                                <Button value="4">4</Button>
                                <Button value="5">5</Button>
                            </ButtonGroup>
                            <h6 className="pt-2" style={{ fontFamily: "SF Pro Display", fontWeight: "300", fontSize: "18px" }}>Buy/Mint with USDT!</h6>
                            <div className="row px-2 pb-2 row-style">
                                <div className="col ">
                                    <Button className="button-style" onClick={mint0} style={{ border: "0.2px", borderRadius: "5px", width: '50px', boxShadow: "1px 1px 5px #000000" }}>
                                        <img src={"usdt.png"} width="100%" alt='ethereum' />
                                    </Button>
                                </div>
                                <div>
                                    <label id='txout' style={{ color: "#39FF14", marginTop: "5px", fontSize: '20px', fontWeight: '500', textShadow: "1px 1px 2px #000000" }}>
                                    <p style={{ fontSize: "20px" }}>Transfer Status</p>
                                    </label>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
                <div className='col-lg-1 col-sm-12'></div>
                <div className='col-lg-8 col-sm-12 mt-3'>
                    <div className='nftstaker border-0'>
                        <div  style={{ fontFamily: "SF Pro Display" }} >
                            <h2 style={{ borderRadius: '14px', fontWeight: "300", fontSize: "25px" }}>TRUCK NFT Staking Vault </h2>
                            <h6 style={{ fontWeight: "300" }}>First time staking?</h6>
                            <Button className="btn" onClick={enable} style={{ backgroundColor: "#ffffff10", boxShadow: "1px 1px 5px #000000" }} >Authorize Your Wallet</Button>
                            <div className="row px-3">
                                <div className="col-lg-4">
                                    <form className="stakingrewards" style={{ borderRadius: "25px", boxShadow: "1px 1px 15px #ffffff" }}>
                                        <h5 style={{ color: "#FFFFFF", fontWeight: '300' }}>Your Vault Activity</h5>
                                        <h6 style={{ color: "#FFFFFF" }}>Verify Staked Amount</h6>
                                        <Button onClick={verify} style={{ backgroundColor: "#ffffff10", boxShadow: "1px 1px 5px #000000" }} >Verify</Button>
                                        <table className='table mt-3 mb-5 px-3 table-dark'>
                                            <tbody>
                                                <tr>
                                                    <td style={{ fontSize: "19px" }}>Your Staked NFTs:
                                                        <span style={{ backgroundColor: "#ffffff00", fontSize: "21px", color: "#39FF14", fontWeight: "500", textShadow: "1px 1px 2px #000000" }}> {stakedNFTs.length}</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style={{ fontSize: "19px" }}>Total Staked NFTs:
                                                    <span style={{ backgroundColor: "#ffffff00", fontSize: "21px", color: "#39FF14", fontWeight: "500", textShadow: "1px 1px 2px #000000" }} > {stakedBalance}</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style={{ fontSize: "19px" }}>Unstake All Staked NFTs
                                                    <Button onClick={UnStakeAll} className='mb-3' style={{ backgroundColor: "#ffffff10", boxShadow: "1px 1px 5px #000000" }}>Unstake All</Button>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </form>
                                </div>
                                <img className="col-lg-4" src="art.png" alt='art'/>
                                <div className="col-lg-4">
                                    <form className='stakingrewards' style={{ borderRadius: "25px", boxShadow: "1px 1px 15px #ffffff", fontFamily: "SF Pro Display" }}>
                                        <h5 style={{ color: "#FFFFFF", fontWeight: '300' }}> Staking Rewards</h5>
                                        <Button onClick={RewardInfo} style={{ backgroundColor: "#ffffff10", boxShadow: "1px 1px 5px #000000" }} >Earned SEMI Rewards</Button>
                                        <div id='earned' style={{ color: "#39FF14", marginTop: "5px", fontSize: '25px', fontWeight: '500', textShadow: "1px 1px 2px #000000" }}>
                                            {rawEarn}
                                            <p style={{ fontSize: "20px" }}>Earned Tokens</p>
                                        </div>
                                        <div className='col-12 mt-2'>
                                            <div style={{ color: 'white' }}>Claim Rewards</div>
                                            <Button onClick={ClaimIt} style={{ backgroundColor: "#ffffff10", boxShadow: "1px 1px 5px #000000" }} className="mb-2">Claim</Button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                            <div className="row px-4 pt-2">
                            <div className="header">
                                    <div style={{ fontSize: '25px', borderRadius: '14px', color: "#ffffff", fontWeight: "300" }}>TRUCK NFT Staking Pool Active Rewards</div>
                                        <table className='table px-3 table-bordered table-dark'>
                                            <thead className='thead-light'>
                                                <tr>
                                                <th scope="col">Collection</th>
                                                <th scope="col">Rewards Per Day</th>
                                                <th scope="col">Exchangeable Items</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                <td>TRUCK Bronze Collection</td>
                                                <td className="amount" data-test-id="rewards-summary-ads">
                                                    <span className="amount">0.50</span>&nbsp;<span className="currency">SEMI</span>
                                                </td>
                                                <td className="exchange">
                                                    <span className="amount">2</span>&nbsp;<span className="currency">NFTs/M</span>
                                                </td>
                                                </tr>
                                                <tr>
                                                <td>TRUCK Silver Collection</td>
                                                <td className="amount" data-test-id="rewards-summary-ac">
                                                    <span className="amount">2.50</span>&nbsp;<span className="currency">SEMI</span>
                                                </td>
                                                <td className="exchange"><span className="amount">10</span>&nbsp;<span className="currency">NFTs/M</span>
                                                </td>
                                                </tr>
                                                <tr className='stakegoldeffect'>
                                                <td>TRUCK Gold Collection</td>
                                                <td className="amount" data-test-id="rewards-summary-one-time"><span className="amount">1</span>&nbsp;<span className="currency">SEMI+</span>
                                                </td>
                                                <td className="exchange">
                                                    <span className="amount">25 NFTs/M or </span>
                                                    <span className="currency">100 SEMI/M</span>
                                                </td>
                                                </tr>
                                            </tbody>
                                        </table>

                                    <div className="header">
                                    <div style={{ fontSize: '25px', borderRadius: '14px', fontWeight: '300' }}>TRUCK Token Stake Farms</div>
                                    <table className='table table-bordered table-dark' style={{ borderRadius: '14px' }} >
                                        <thead className='thead-light'>
                                        <tr>
                                            <th scope="col">Farm Pools</th>
                                            <th scope="col">Harvest Daily Earnings</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        <tr>
                                            <td>Stake TRUCK to Earn SEMI</td>
                                            <td className="amount" data-test-id="rewards-summary-ads">
                                            <span className="amount">0.01</span>&nbsp;<span className="currency">Per TRUCK</span>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>Stake TRUCK to Earn SEMI+</td>
                                            <td className="amount" data-test-id="rewards-summary-ac">
                                            <span className="amount">0.005</span>&nbsp;<span className="currency">Per TRUCK</span>
                                            </td>
                                        </tr>
                                        </tbody>
                                    </table>
                                    </div>
                                </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className='row nftportal mt-3 pb-3'>
                <div className='col'>
                    <h1 className='n2dtitlestyle mt-3'>Your NFT Portal</h1>
                    <Button onClick={refreshPage} style={{ backgroundColor: "#000000", boxShadow: "1px 1px 5px #000000" }}>Refresh NFT Portal</Button>
                </div>
            </div>
            <NFT nfts={nfts} nftStk={nftStk} loadingState={loadingState} account={account} vaultContract={vaultContract} />
            <NotificationContainer />
      </div>
    )
}

export default App;