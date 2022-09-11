import React from 'react';
import { Button } from 'react-bootstrap';

export default function NFT(props) {
    const { nfts, nftStk, loadingState, account, vaultContract } = props;
    const Stake = async (nft) => {
        vaultContract.methods.stake([nft.tokenId]).send({ from: account });
    }

    const UnStake = async (nft) => {
        vaultContract.methods.unstake([nft.tokenId]).send({ from: account });
    }


    if ( loadingState === 'not-loaded' && !nfts.length ) {
        return (
            <></>
        )
    }
    
    return (
        <div className='nftportal'>
            <div className="container-fluid">
                <div className="row items px-3 pt-3">
                    { nfts.filter(nft => nft.wallet.toLowerCase().indexOf(nft.holder) !== -1).map((nft, i) => {
                        return (
                            <div className='col-lg-3 col-md-6 col-sm-12 p-5' key={i}>
                                <div className="card nft-card mt-3 mb-3">
                                    <div className="image-over">
                                        <img className="card-img-top" src={`${process.env.REACT_APP_IMAGE_URI}/${nft.tokenId}.png`} alt={nft.tokenId} />
                                    </div>
                                    <div className="card-caption col-12 p-0">
                                        <div className="card-body">
                                            <h5 className="mb-0">TRUCK Collection NFT #{nft.tokenId}</h5>
                                            <h5 className="mb-0 mt-2">Status<p style={{ color: "#39FF14", fontWeight: "bold", textShadow: "1px 1px 2px #000000" }}>Ready to Stake</p></h5>
                                            <div className="card-bottom d-flex justify-content-center">
                                                <input key={i} type="hidden" id='stakeid' value={nft.tokenId} />
                                                <Button style={{ marginLeft: '2px', backgroundColor: "#ffffff10" }} onClick={() => Stake(nft)}>Stake it</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {nftStk.map((nft, i) => {
                        return (
                            <div className='col-lg-3 col-md-6 col-sm-12 p-5' key={i}>
                                <div className="card stakedcard mt-3 mb-3">
                                    <div className="image-over">
                                        <img style={{position:'absolute',top:'0.05rem',width:'90px'}} src='stakeicon.png' alt='stakeicon'></img>
                                        <img className="card-img-top" src={`${process.env.REACT_APP_IMAGE_URI}/${nft.tokenId}.png`} alt={nft.tokenId} />
                                    </div>
                                    <div className="card-caption col-12 p-0">
                                        <div className="card-body">
                                            <h5 className="mb-0">TRUCK Collection NFT #{nft.tokenId}</h5>
                                            <h5 className="mb-0 mt-2">Status<p style={{ color: "#15F4EE", fontWeight: "bold", textShadow: "1px 1px 2px #000000" }}>Currently Staked</p></h5>
                                            <div className="card-bottom d-flex justify-content-center">
                                                <input key={i} type="hidden" id='stakeid' value={nft.tokenId} />
                                                <Button style={{ marginLeft: '2px', backgroundColor: "#ffffff10" }} onClick={() => UnStake(nft)}>Unstake it</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                    )})}
                </div>
            </div>
        </div>
    )
}
    