#!/usr/bin/python3

#Import required libraries
import sys
import os
import argparse
import ipaddress
import getpass


#Define arguments
parser = argparse.ArgumentParser()
group = parser.add_mutually_exclusive_group()
group.add_argument("-s", "--setup", action="store_true", help="Run setup wizard to create a configuration file")
group.add_argument("-l", "--learn", action="store_true", help="Scan the network to learn MAC addresses with no notifications")
group.add_argument("-c", "--check", action="store_true", help="Scan the network and alert on any new MAC addresses")
parser.add_argument("-v", "--verbose", action="store_true", help="Verbose output on the command prompt for troubleshooting")
args = parser.parse_args()

#This function takes in a string which should be a comma seperated list of subnets.
#It splits the list and verifies that each subnet is valid.
def verifySubnets(subnets):
  split_subnets = subnets.split(',')
  for network in split_subnets:
    try:
      ipaddress.ip_network(network)
    except:
      print("Invalid Subnet %s" % (network) + "\n")
      return False
  return True

#The main function to call if the --setup option is selected.
#This function should ask the user a series of questions, verify the answers, and create a configuration file.
if args.setup:
  subnets = ""

  os.system('clear')
  input("This setup wizard will ask you a series of questions which will be used to build a configuration file.  Press enter to continue.\n")
  os.system('clear')

  while True:
    subnets = input("Please enter a comma seperated list of subnets that you would like to scan.  Exmaple: 192.168.1.0/24,10.10.0.0/16 \n")
    
    if verifySubnets(subnets):
      break
    else:
      input("Press enter to try again.")
      os.system('clear')

  os.system('clear')
  print("subnets: %s" % (subnets))


  print("Setup Complete")
  sys.exit(0)

#The main function to call if the --learn option is selected.
#This function should check for a configuration file and verify the subnets
#Then this function should scan each subnet and record all identified MAC addresses
elif args.learn:
  print("Learning Complete")
  sys.exit(0)

#The main function to call if the --check option is selected.
#This function should check for a configuration file and verify the subnets
#Then this function should read all recoreded MAC addresses into memory
#Finally this function should scan all subnets and identify any new MAC addresses
#If new MAC address are found an email should be generated
else:
  print("Checking Complete")
  sys.exit(0)