require('dotenv').config();

module.exports = {
  // 网络配置
  BSC_RPC_URL: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
  
  // 合约地址
  PANCAKESWAP_V2_ROUTER: process.env.PANCAKESWAP_V2_ROUTER || '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  PANCAKESWAP_V2_FACTORY: process.env.PANCAKESWAP_V2_FACTORY || '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
  WBNB_ADDRESS: process.env.WBNB_ADDRESS || '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  
  // 监控比率配置
  LIQUIDTY_RATE: parseFloat(process.env.LIQUIDTY_RATE) || 0.1,
  
  // 配置参数
  MARKET_CAP_PERCENTAGES: [
    parseFloat(process.env.MARKET_CAP_PERCENTAGE_1) || 0.5,
    parseFloat(process.env.MARKET_CAP_PERCENTAGE_2) || 5
  ],
  MONITORING_INTERVAL: parseInt(process.env.MONITORING_INTERVAL) || 10000,
  
  // PancakeSwap Router ABI (简化版，包含必要方法)
  ROUTER_ABI: [
    "function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint amountOut)",
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
  ],
  
  // PancakeSwap Factory ABI
  FACTORY_ABI: [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)"
  ],
  
  // ERC20 Token ABI
  TOKEN_ABI: [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)"
  ],
  
  // Pair ABI
  PAIR_ABI: [
    "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function totalSupply() external view returns (uint256)"
  ]
}; 