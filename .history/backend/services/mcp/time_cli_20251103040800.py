#!/usr/bin/env python3
"""
时间工具命令行接口
提供命令行方式调用时间工具API
"""

import argparse
import asyncio
import json
import sys
from typing import Dict, Any

# 添加项目路径到sys.path，以便导入本地模块
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.mcp.time_tools_client import TimeToolsClient


async def get_current_time(args):
    """获取当前时间命令处理"""
    client = TimeToolsClient(args.server)
    
    try:
        result = await client.get_current_time(
            timezone=args.timezone,
            format=args.format
        )
        
        if args.json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            data = result["data"]
            print(f"当前时间: {data['formatted']}")
            print(f"时区: {data['timezone']}")
            print(f"Unix时间戳: {data['unix_timestamp']}")
            
    finally:
        await client.close()


async def calculate_time(args):
    """时间计算命令处理"""
    client = TimeToolsClient(args.server)
    
    try:
        if args.operation == "diff":
            if not args.target_time:
                print("错误: diff操作需要指定--target-time参数", file=sys.stderr)
                return 1
                
            result = await client.calculate_time(
                operation=args.operation,
                base_time=args.base_time,
                target_time=args.target_time
            )
        else:
            if args.value is None:
                print("错误: add/subtract操作需要指定--value参数", file=sys.stderr)
                return 1
                
            result = await client.calculate_time(
                operation=args.operation,
                base_time=args.base_time,
                value=args.value,
                unit=args.unit
            )
        
        if args.json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            data = result["data"]
            if args.operation == "diff":
                print(f"时间差: {data['result']['formatted']}")
                print(f"总秒数: {data['result']['total_seconds']}")
            else:
                print(f"计算结果: {data['result']}")
                print(f"操作: {data['description']}")
            
    finally:
        await client.close()


async def list_timezones(args):
    """列出时区命令处理"""
    client = TimeToolsClient(args.server)
    
    try:
        result = await client.list_timezones()
        
        if args.json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print("支持的时区:")
            for tz in result["data"]["timezones"]:
                print(f"  {tz['id']}: {tz['name']}")
            
    finally:
        await client.close()


async def measure_execution(args):
    """测量命令执行时间"""
    if not args.command:
        print("错误: 需要指定要测量的命令", file=sys.stderr)
        return 1
    
    client = TimeToolsClient(args.server)
    
    try:
        # 获取开始时间
        start_time = await client.get_current_time(format="unix")
        start_ts = start_time["data"]["unix_timestamp"]
        
        # 执行命令
        print(f"执行命令: {' '.join(args.command)}")
        exit_code = os.system(" ".join(args.command))
        
        # 获取结束时间
        end_time = await client.get_current_time(format="unix")
        end_ts = end_time["data"]["unix_timestamp"]
        
        # 计算时间差
        diff = await client.calculate_time(
            operation="diff",
            base_time=f"1970-01-01T{start_ts}Z",
            target_time=f"1970-01-01T{end_ts}Z"
        )
        
        exec_time = diff["data"]["result"]["formatted"]
        print(f"\n命令执行时间: {exec_time}")
        print(f"退出代码: {exit_code}")
        
        return exit_code
            
    finally:
        await client.close()


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description="时间工具命令行接口")
    parser.add_argument("--server", default="http://localhost:8000", 
                       help="API服务器地址 (默认: http://localhost:8000)")
    parser.add_argument("--json", action="store_true", 
                       help="以JSON格式输出结果")
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    # 当前时间命令
    now_parser = subparsers.add_parser("now", help="获取当前时间")
    now_parser.add_argument("--timezone", help="时区 (如: Asia/Shanghai, UTC)")
    now_parser.add_argument("--format", choices=["iso", "unix", "readable"], 
                           default="readable", help="时间格式 (默认: readable)")
    now_parser.set_defaults(func=get_current_time)
    
    # 时间计算命令
    calc_parser = subparsers.add_parser("calc", help="时间计算")
    calc_parser.add_argument("operation", choices=["add", "subtract", "diff"], 
                            help="操作类型")
    calc_parser.add_argument("--base-time", help="基准时间 (ISO格式)")
    calc_parser.add_argument("--value", type=int, help="数值 (用于add/subtract)")
    calc_parser.add_argument("--unit", choices=["seconds", "minutes", "hours", "days"], 
                           default="minutes", help="时间单位 (默认: minutes)")
    calc_parser.add_argument("--target-time", help="目标时间 (用于diff, ISO格式)")
    calc_parser.set_defaults(func=calculate_time)
    
    # 时区列表命令
    tz_parser = subparsers.add_parser("timezones", help="列出支持的时区")
    tz_parser.set_defaults(func=list_timezones)
    
    # 测量命令执行时间
    measure_parser = subparsers.add_parser("measure", help="测量命令执行时间")
    measure_parser.add_argument("command", nargs=argparse.REMAINDER, 
                              help="要测量的命令")
    measure_parser.set_defaults(func=measure_execution)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    # 执行命令
    exit_code = asyncio.run(args.func(args))
    return exit_code if exit_code is not None else 0


if __name__ == "__main__":
    sys.exit(main())