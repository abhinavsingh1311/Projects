﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace ReceivingSystem.ViewModels
{
	public class UnorderedReturnItemView
	{
		public int? UnorderedItemID { get; set; }
		public string Description { get; set; }
		public string VendorSerialNumber { get; set; }
		public int Quantity { get; set; }
	}
}
